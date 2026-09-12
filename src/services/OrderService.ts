import type { IOrderRepository } from '../interfaces/IOrderRepository.js';
import type { IOrder, CreateOrderDTO, UpdateOrderDTO } from '../types/order.types.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import kloudShipService from './KloudShipService.js';

/**
 * Splits a single stored "name" field into first/last name for carrier labels.
 */
const splitName = (fullName?: string): { firstName: string; lastName: string } => {
  const parts = (fullName || 'Customer').trim().split(/\s+/);
  return { firstName: parts[0] || 'Customer', lastName: parts.slice(1).join(' ') };
};

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
  constructor(private readonly orderRepository: IOrderRepository) { }

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

    // 2b. Quote live shipping rate (authoritative — recalculated here, not trusted from client)
    const shippingUser = await User.findById(userId);
    const { firstName, lastName } = splitName(shippingUser?.name);
    const rate = await kloudShipService.getCheapestRate({
      addressTo: {
        firstName,
        lastName,
        email: shippingUser?.email || '',
        phone: shippingAddress.phone,
        address: shippingAddress.address,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zip,
      },
      items: resolvedItems.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
    });
    const shippingCost = Math.round(rate.totalFee);
    calculatedTotal += shippingCost;

    // 3. Create Order document in DB
    const newOrder = await this.orderRepository.create({
      user: userId,
      items: resolvedItems,
      totalAmount: calculatedTotal,
      shippingAddress,
      shippingCost,
      shipping: {
        carrierAccountId: rate.carrierAccountId,
        carrier: rate.carrier,
        service: rate.service,
        estimatedDeliveryDays: rate.deliveryDaysEstimated,
      },
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

      await this.fulfillShipment(newOrder.id!);

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

      await this.fulfillShipment(newOrder.id!);

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

    await this.fulfillShipment(orderId);

    return {
      success: true,
      message: 'Payment verified and captured successfully!',
      order: updatedOrder,
    };
  }

  /**
   * 📦 Create the KloudShip shipment (label + tracking number) after payment
   * succeeds. Non-fatal on failure — the order itself must not fail just
   * because the carrier API had a hiccup; the error is stored for follow-up.
   */
  private async fulfillShipment(orderId: string): Promise<void> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) return;

      const userDoc = await User.findById(order.user && (order.user as any)._id ? (order.user as any)._id : order.user);
      const { firstName, lastName } = splitName(userDoc?.name);

      const shipment = await kloudShipService.createShipment({
        addressShipTo: {
          firstName,
          lastName,
          email: userDoc?.email || '',
          phone: order.shippingAddress.phone,
          address: order.shippingAddress.address,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          zip: order.shippingAddress.zip,
        },
        items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
        carrierAccountId: order.shipping?.carrierAccountId || '',
        service: order.shipping?.service || '',
        orderCode: (order.id || order._id || orderId).toString(),
      });

      await this.orderRepository.update(orderId, {
        shipping: {
          ...order.shipping,
          shipmentId: shipment.id,
          trackingNumber: shipment.trackingNumber,
          trackingUrl: shipment.trackingUrl,
          labelUrl: shipment.labels?.[0]?.url,
          processedStatus: shipment.processedStatus,
        },
      });
    } catch (err: any) {
      console.error(`KloudShip shipment creation failed for order ${orderId}:`, err.message);
      const order = await this.orderRepository.findById(orderId);
      await this.orderRepository.update(orderId, {
        shipping: { ...order?.shipping, error: err.message },
      }).catch(() => {});
    }
  }

  /**
   * 🚚 Quote a live shipping rate for the cart + destination address, shown
   * at checkout before the order is placed. Recalculated authoritatively in
   * createCheckoutSession, so this is display-only.
   */
  async getShippingRate(userId: string, userRole: string, items: any[], shippingAddress: any): Promise<any> {
    if (!items || items.length === 0) {
      throw new Error('Shopping cart is empty.');
    }
    if (!shippingAddress || !shippingAddress.address || !shippingAddress.phone || !shippingAddress.state) {
      throw new Error('A complete shipping address is required to calculate shipping.');
    }

    const resolvedItems = [];
    for (const cartItem of items) {
      const product = await Product.findById(cartItem.productId);
      if (!product || product.isBlocked) {
        throw new Error(`Product not found: ${cartItem.name || 'Unknown'}`);
      }
      resolvedItems.push({
        name: product.name,
        quantity: cartItem.quantity,
        price: getProductPriceForUser(product, userRole),
      });
    }

    const userDoc = await User.findById(userId);
    const { firstName, lastName } = splitName(userDoc?.name);

    const rate = await kloudShipService.getCheapestRate({
      addressTo: {
        firstName,
        lastName,
        email: userDoc?.email || '',
        phone: shippingAddress.phone,
        address: shippingAddress.address,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zip,
      },
      items: resolvedItems,
    });

    return {
      shippingCost: Math.round(rate.totalFee),
      carrier: rate.carrier,
      service: rate.service,
      estimatedDeliveryDays: rate.deliveryDaysEstimated,
    };
  }

  /**
   * 📦 Fetch the latest tracking status for an order from KloudShip.
   */
  async getOrderTracking(orderId: string, userId: string, userRole: string): Promise<any> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Associated order record not found.');
    }

    const isOwner = order.user.toString() === userId || (typeof order.user === 'object' && order.user._id?.toString() === userId);
    if (!isOwner && userRole !== 'Admin') {
      throw new Error('Security Alert! Unauthorized access to this order.');
    }

    if (!order.shipping?.trackingNumber) {
      return { status: 'NotShipped', message: 'This order has not been shipped yet.' };
    }

    const tracking = await kloudShipService.getTracking(order.shipping.trackingNumber);

    if (tracking.processedStatus && tracking.processedStatus !== order.shipping.processedStatus) {
      await this.orderRepository.update(orderId, {
        shipping: { ...order.shipping, processedStatus: tracking.processedStatus },
      });
    }

    return {
      carrier: order.shipping.carrier,
      trackingNumber: order.shipping.trackingNumber,
      trackingUrl: order.shipping.trackingUrl,
      processedStatus: tracking.processedStatus,
      status: tracking.status,
      events: tracking.events || [],
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

  /**
   * ❌ Customer: Cancel Individual Order Item (Partial Cancellation)
   */
  async cancelOrderItem(orderId: string, itemId: string, userId: string, userRole: string, reason?: string): Promise<any> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new Error('Associated order record not found.');

    const isOwner = order.user.toString() === userId || (typeof order.user === 'object' && order.user._id?.toString() === userId);
    if (!isOwner && userRole !== 'Admin') throw new Error('Security Alert! Unauthorized cancellation attempt.');

    if (order.orderStatus !== 'Pending' && order.orderStatus !== 'Processing') {
      throw new Error(`Orders marked '${order.orderStatus}' cannot have items cancelled.`);
    }

    const itemIndex = order.items.findIndex((item: any) => item._id?.toString() === itemId || item.id?.toString() === itemId);
    if (itemIndex === -1) throw new Error('Item not found in order.');

    const item = order.items[itemIndex];
    if (!item) throw new Error('Item not found in order.');
    if (item.itemStatus === 'Cancelled') throw new Error('This item is already cancelled.');

    // Calculate item specific refund
    const itemRefundAmount = item.price * item.quantity;

    // Update the items array
    const updatedItems = [...order.items] as any[];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex]._doc || updatedItems[itemIndex],
      itemStatus: 'Cancelled',
      cancelReason: reason || 'Cancelled by buyer'
    };

    // Check if ALL items are now cancelled
    const allCancelled = updatedItems.every(i => i.itemStatus === 'Cancelled');

    const updates: any = { items: updatedItems };
    if (allCancelled) {
      updates.orderStatus = 'Cancelled';
      updates.cancelReason = 'All items were individually cancelled.';
      if (order.paymentStatus === 'Paid') updates.paymentStatus = 'Refunded';
    }

    const updatedOrder = await this.orderRepository.update(orderId, updates);

    // Stock Restoral for this item
    const Product = (await import('../models/Product.js')).default;
    await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });

    // Wallet Partial/Full Refund
    if (order.paymentStatus === 'Paid') {
      const User = (await import('../models/User.js')).default;
      const userIdToRefund = (order.user && (order.user as any)._id) ? (order.user as any)._id : order.user;
      await User.findByIdAndUpdate(userIdToRefund, {
        $inc: { walletBalance: itemRefundAmount },
        $push: {
          walletHistory: {
            type: 'Credit',
            amount: itemRefundAmount,
            description: `Refund for Cancelled Item in Order #${orderId.substring(18).toUpperCase()}`,
            date: new Date(),
          }
        }
      });
    }

    return {
      success: true,
      message: 'Item cancelled successfully and inventory restored!',
      order: updatedOrder,
    };
  }

  /**
   * 🔄 Customer: Request Item Return
   */
  async requestOrderItemReturn(orderId: string, itemId: string, userId: string, reason: string): Promise<any> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) throw new Error('Associated order record not found.');

    const isOwner = order.user.toString() === userId || (typeof order.user === 'object' && order.user._id?.toString() === userId);
    if (!isOwner) throw new Error('Security Alert! Unauthorized return attempt.');

    if (order.orderStatus !== 'Delivered') {
      throw new Error('Only successfully delivered orders are eligible for return.');
    }

    const itemIndex = order.items.findIndex((item: any) => item._id?.toString() === itemId || item.id?.toString() === itemId);
    if (itemIndex === -1) throw new Error('Item not found in order.');

    const item = order.items[itemIndex];
    if (!item) throw new Error('Item not found in order.');
    if (item.returnStatus && item.returnStatus !== 'None') {
      throw new Error(`A return request has already been submitted for this item (Status: ${item.returnStatus}).`);
    }

    const updatedItems = [...order.items] as any[];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex]._doc || updatedItems[itemIndex],
      returnStatus: 'Pending',
      returnReason: reason || 'No return reason provided'
    };

    const updatedOrder = await this.orderRepository.update(orderId, { items: updatedItems });

    return {
      success: true,
      message: 'Return request for item submitted successfully!',
      order: updatedOrder,
    };
  }
}

export default OrderService;
