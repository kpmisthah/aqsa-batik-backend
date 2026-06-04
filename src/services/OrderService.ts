import type { IOrderRepository } from '../interfaces/IOrderRepository.js';
import type { IOrder, CreateOrderDTO, UpdateOrderDTO } from '../types/order.types.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay SDK
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholderKeyId';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'placeholderSecret';

const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret,
});

/**
 * Recalculate prices based on buyer role securely
 */
const getProductPriceForUser = (product: any, role?: string): number => {
  if (role === 'Wholesaler') {
    // Wholesalers get wholesale rates (40% discount off standard fullPrice, or discountPrice if lower)
    const wholesalePrice = Math.round(product.fullPrice * 0.6);
    return Math.min(wholesalePrice, product.discountPrice || product.fullPrice);
  }
  // Standard customers pay discountPrice or fullPrice
  return product.discountPrice || product.fullPrice;
};

class OrderService {
  constructor(private readonly orderRepository: IOrderRepository) {}

  /**
   * 💳 Create Checkout Session & Razorpay Order
   */
  async createCheckoutSession(
    userId: string,
    userRole: string,
    items: any[],
    shippingAddress: any,
    paymentMethod: 'Razorpay' | 'COD' | 'Wallet'
  ): Promise<any> {
    if (!items || items.length === 0) {
      throw new Error('Shopping cart is empty.');
    }

    if (!shippingAddress || !shippingAddress.address || !shippingAddress.phone) {
      throw new Error('Shipping address and phone are required.');
    }

    let calculatedTotal = 0;
    let totalItemsQuantity = 0;
    const resolvedItems = [];

    // 1. Recalculate pricing on backend to prevent tampering
    for (const cartItem of items) {
      const product = await Product.findById(cartItem.productId);
      if (!product || product.isBlocked) {
        throw new Error(`Product not found: ${cartItem.name || 'Unknown'}`);
      }

      // Check stock limits
      if (product.quantity < cartItem.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}`);
      }

      // Verify Wholesaler restrictions
      if (product.isWholesale && userRole !== 'Wholesaler') {
        throw new Error(`Product "${product.name}" is reserved for Wholesaler accounts only.`);
      }

      const verifiedPrice = getProductPriceForUser(product, userRole);
      calculatedTotal += verifiedPrice * cartItem.quantity;
      totalItemsQuantity += cartItem.quantity;

      resolvedItems.push({
        product: product.id,
        name: product.name,
        quantity: cartItem.quantity,
        variantColour: cartItem.variantColour || '',
        price: verifiedPrice,
      });
    }

    // 2. Enforce Wholesaler MOQ Policies
    if (userRole === 'Wholesaler') {
      const MINIMUM_WHOLESALE_AMOUNT = 10000; // ₹10,000 INR
      const MINIMUM_WHOLESALE_QUANTITY = 10;   // 10 Items minimum

      if (calculatedTotal < MINIMUM_WHOLESALE_AMOUNT && totalItemsQuantity < MINIMUM_WHOLESALE_QUANTITY) {
        throw new Error(
          `Wholesale trade requires a minimum order of ₹${MINIMUM_WHOLESALE_AMOUNT} INR or at least ${MINIMUM_WHOLESALE_QUANTITY} items in cart.`
        );
      }
    }

    // 3. Create Order document in DB
    const newOrder = await this.orderRepository.create({
      user: userId,
      items: resolvedItems,
      totalAmount: calculatedTotal,
      shippingAddress,
      paymentStatus: 'Pending',
      paymentMethod: paymentMethod || 'Razorpay',
    });

    // Update user default address fields
    await User.findByIdAndUpdate(userId, {
      $set: {
        address: shippingAddress.address,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zip,
        phone: shippingAddress.phone,
      }
    });

    if (paymentMethod === 'Wallet') {
      const userDoc = await User.findById(userId);
      if (!userDoc) throw new Error('User not found.');
      
      if ((userDoc.walletBalance || 0) < calculatedTotal) {
        throw new Error(`Insufficient wallet balance. You have ₹${userDoc.walletBalance || 0}, but the order total is ₹${calculatedTotal}.`);
      }

      // Deduct from wallet and add history
      await User.findByIdAndUpdate(userId, {
        $inc: { walletBalance: -calculatedTotal },
        $push: {
          walletHistory: {
            type: 'Debit',
            amount: calculatedTotal,
            description: `Payment for Order #${newOrder.id?.substring(18).toUpperCase()}`,
            date: new Date(),
          }
        }
      });

      // Mark order as Paid since Wallet deduction was successful
      await this.orderRepository.update(newOrder.id!, {
        paymentStatus: 'Paid',
      });

      // Subtract product stock/inventory
      for (const item of resolvedItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: -item.quantity },
        });
      }

      return {
        success: true,
        message: 'Order placed successfully using Wallet Balance.',
        orderId: newOrder.id,
        totalAmount: calculatedTotal,
        paymentMethod: 'Wallet',
      };
    }

    if (paymentMethod === 'COD') {
      // Subtract product stock/inventory immediately for COD
      for (const item of resolvedItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: -item.quantity },
        });
      }

      return {
        success: true,
        message: 'COD order placed successfully.',
        orderId: newOrder.id,
        totalAmount: calculatedTotal,
        paymentMethod: 'COD',
      };
    }

    // 4. Create Razorpay order (amount in paise)
    const rzpOrder = await razorpay.orders.create({
      amount: calculatedTotal * 100,
      currency: 'INR',
      receipt: `receipt_order_${newOrder.id}`,
    });

    // 5. Update Order in DB with Razorpay Order ID
    await this.orderRepository.update(newOrder.id!, {
      paymentGatewayOrderId: rzpOrder.id,
    });

    return {
      success: true,
      message: 'Razorpay order created successfully.',
      keyId: razorpayKeyId,
      amount: rzpOrder.amount, // in paise
      currency: rzpOrder.currency,
      rzpOrderId: rzpOrder.id,
      orderId: newOrder.id,
      totalAmount: calculatedTotal, // in INR
    };
  }

  /**
   * 🔒 Verify Razorpay Payment Signature
   */
  async verifyPayment(
    rzpOrderId: string,
    rzpPaymentId: string,
    rzpSignature: string,
    orderId: string
  ): Promise<any> {
    if (!rzpOrderId || !rzpPaymentId || !rzpSignature || !orderId) {
      throw new Error('Missing payment signature verification parameters.');
    }

    // Verify transaction signature using SHA256 HMAC
    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(`${rzpOrderId}|${rzpPaymentId}`)
      .digest('hex');

    if (expectedSignature !== rzpSignature) {
      throw new Error('Security Alert! Payment signature mismatch.');
    }

    // Update order status to Paid
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Associated order record not found.');
    }

    const updatedOrder = await this.orderRepository.update(orderId, {
      paymentStatus: 'Paid',
      paymentId: rzpPaymentId,
    });

    // Subtract product stock/inventory
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: -item.quantity },
      });
    }

    return {
      success: true,
      message: 'Payment verified and captured successfully!',
      order: updatedOrder,
    };
  }

  /**
   * 📜 Get Logged-In User Orders (Order History)
   */
  async getUserOrders(userId: string): Promise<any> {
    return await this.orderRepository.findByUser(userId);
  }

  /**
   * 💳 Secure Payment Retry session creator for pending orders
   */
  async retryOrderPayment(orderId: string, userId: string): Promise<any> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Associated order record not found.');
    }

    // Security check: Verify order belongs to the requesting user
    if (order.user.toString() !== userId && (typeof order.user === 'object' && order.user._id?.toString() !== userId)) {
      throw new Error('Security Alert! Unauthorized access to this order.');
    }

    if (order.paymentStatus === 'Paid') {
      throw new Error('This order is already successfully paid.');
    }

    // Ensure Razorpay Order ID exists, or generate a fresh one if missing/expired
    let rzpOrderId = order.paymentGatewayOrderId;
    if (!rzpOrderId) {
      const rzpOrder = await razorpay.orders.create({
        amount: order.totalAmount * 100, // in paise
        currency: 'INR',
        receipt: `receipt_order_${order.id}`,
      });
      await this.orderRepository.update(orderId, {
        paymentGatewayOrderId: rzpOrder.id,
      });
      rzpOrderId = rzpOrder.id;
    }

    return {
      success: true,
      message: 'Razorpay retry session created successfully.',
      keyId: razorpayKeyId,
      amount: order.totalAmount * 100, // in paise
      currency: 'INR',
      rzpOrderId: rzpOrderId,
      orderId: order.id,
      totalAmount: order.totalAmount, // in INR
    };
  }

  /**
   * 📦 Admin: Get All Store Orders (with pagination support)
   */
  async getAllOrders(page?: number, limit?: number): Promise<any> {
    return await this.orderRepository.findAll(page, limit);
  }

  /**
   * 🔄 Admin: Update Order Fulfillment or Payment Status
   */
  async updateOrderStatus(
    orderId: string,
    status?: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned',
    paymentStatus?: 'Pending' | 'Paid' | 'Failed'
  ): Promise<any> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Associated order record not found.');
    }

    if (order.orderStatus === 'Delivered' && status === 'Cancelled') {
      throw new Error('Delivered orders cannot be cancelled.');
    }

    const updates: UpdateOrderDTO = {};

    // 1. Automatically restore inventory stock if transitioning into Cancelled from another state
    if (status === 'Cancelled' && order.orderStatus !== 'Cancelled') {
      console.log(`📦 Admin Cancellation: Restoring product stock for order ${order._id}`);
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: item.quantity },
        });
      }
      
      // Automatically refund to wallet if payment was already made
      if (order.paymentStatus === 'Paid') {
        const userIdToRefund = (order.user && (order.user as any)._id) ? (order.user as any)._id : order.user;
        await User.findByIdAndUpdate(userIdToRefund, {
          $inc: { walletBalance: order.totalAmount },
          $push: {
            walletHistory: {
              type: 'Credit',
              amount: order.totalAmount,
              description: `Refund for Cancelled Order #${(order._id || order.id || '').toString().substring(18).toUpperCase()}`,
              date: new Date(),
            }
          }
        });
        updates.paymentStatus = 'Refunded';
        console.log(`💰 Refunded ₹${order.totalAmount} to Wallet for User ${userIdToRefund}`);
      }

      updates.cancelReason = 'Cancelled by Administrator';
    }

    if (status !== undefined) {
      updates.orderStatus = status;
    }
    if (paymentStatus !== undefined) {
      updates.paymentStatus = paymentStatus;
    }

    const updatedOrder = await this.orderRepository.update(orderId, updates);
    return {
      success: true,
      message: 'Order status updated successfully!',
      order: updatedOrder,
    };
  }

  /**
   * ❌ Customer: Cancel Order (with Reason and automatic Stock Restoral)
   */
  async cancelOrder(orderId: string, userId: string, userRole: string, reason?: string): Promise<any> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Associated order record not found.');
    }

    // Security check: Only the owning user or an Admin can cancel this order
    const isOwner = order.user.toString() === userId || (typeof order.user === 'object' && order.user._id?.toString() === userId);
    if (!isOwner && userRole !== 'Admin') {
      throw new Error('Security Alert! Unauthorized cancellation attempt.');
    }

    // Cancellation constraint check: can only cancel if Pending or Processing
    if (order.orderStatus !== 'Pending' && order.orderStatus !== 'Processing') {
      throw new Error(`Orders marked '${order.orderStatus}' cannot be cancelled.`);
    }

    const updatedOrder = await this.orderRepository.update(orderId, {
      orderStatus: 'Cancelled',
      cancelReason: reason || 'Cancelled by buyer',
      paymentStatus: order.paymentStatus === 'Paid' ? 'Refunded' : order.paymentStatus,
    });

    // Automatic stock restoral since order is cancelled
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: item.quantity },
      });
    }

    // Wallet Refund
    if (order.paymentStatus === 'Paid') {
      const userIdToRefund = (order.user && (order.user as any)._id) ? (order.user as any)._id : order.user;
      await User.findByIdAndUpdate(userIdToRefund, {
        $inc: { walletBalance: order.totalAmount },
        $push: {
          walletHistory: {
            type: 'Credit',
            amount: order.totalAmount,
            description: `Refund for Cancelled Order #${orderId.substring(18).toUpperCase()}`,
            date: new Date(),
          }
        }
      });
    }

    return {
      success: true,
      message: 'Order cancelled successfully and product inventory restored!',
      order: updatedOrder,
    };
  }

  /**
   * 🔄 Customer: Request Order Return (with Reason)
   */
  async requestOrderReturn(orderId: string, userId: string, reason: string): Promise<any> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Associated order record not found.');
    }

    // Security check: Only the owning user can initiate a return
    const isOwner = order.user.toString() === userId || (typeof order.user === 'object' && order.user._id?.toString() === userId);
    if (!isOwner) {
      throw new Error('Security Alert! Unauthorized return attempt.');
    }

    // Return constraint check: only Delivered orders can be returned
    if (order.orderStatus !== 'Delivered') {
      throw new Error('Only successfully delivered orders are eligible for return.');
    }

    // Prevent duplicate returns
    if (order.returnStatus !== 'None') {
      throw new Error(`A return request has already been submitted (Status: ${order.returnStatus}).`);
    }

    const updatedOrder = await this.orderRepository.update(orderId, {
      returnStatus: 'Pending',
      returnReason: reason || 'No return reason provided',
    });

    return {
      success: true,
      message: 'Return request submitted successfully!',
      order: updatedOrder,
    };
  }

  /**
   * ⚖️ Admin: Approve or Reject Returns (with Stock Restoral on Approval)
   */
  async verifyOrderReturn(orderId: string, action: 'Approve' | 'Reject'): Promise<any> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Associated order record not found.');
    }

    if (order.returnStatus !== 'Pending') {
      throw new Error('No pending return request found for this order.');
    }

    const updates: UpdateOrderDTO = {};

    if (action === 'Approve') {
      updates.returnStatus = 'Approved';
      updates.orderStatus = 'Returned';

      // Stock restoral since items are returned to catalog inventory
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: item.quantity },
        });
      }

      // Wallet Refund
      if (order.paymentStatus === 'Paid') {
        const userIdToRefund = (order.user && (order.user as any)._id) ? (order.user as any)._id : order.user;
        await User.findByIdAndUpdate(userIdToRefund, {
          $inc: { walletBalance: order.totalAmount },
          $push: {
            walletHistory: {
              type: 'Credit',
              amount: order.totalAmount,
              description: `Refund for Returned Order #${orderId.substring(18).toUpperCase()}`,
              date: new Date(),
            }
          }
        });
        updates.paymentStatus = 'Refunded';
      }
    } else if (action === 'Reject') {
      updates.returnStatus = 'Rejected';
    } else {
      throw new Error("Invalid action. Must be 'Approve' or 'Reject'.");
    }

    const updatedOrder = await this.orderRepository.update(orderId, updates);
    return {
      success: true,
      message: `Return request successfully ${action === 'Approve' ? 'approved' : 'rejected'}!`,
      order: updatedOrder,
    };
  }
}

export default OrderService;
