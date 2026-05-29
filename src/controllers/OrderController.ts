import type { Request, Response } from 'express';
import OrderService from '../services/OrderService.js';
import orderRepository from '../repositories/OrderRepository.js';

/**
 * OrderController - HTTP layer only (SRP)
 * Handles request parsing and response formatting.
 * Delegates all business logic to OrderService.
 */
const orderService = new OrderService(orderRepository);

/**
 * 💳 Create Checkout Session & Razorpay Order
 */
export const createCheckoutSession = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role || 'Customer';

    if (!userId) {
      return res.status(401).json({ message: 'User unauthorized. Please login.' });
    }

    const { items, shippingAddress, paymentMethod } = req.body;
    const result = await orderService.createCheckoutSession(userId, userRole, items, shippingAddress, paymentMethod);
    
    return res.status(201).json(result);
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(400).json({ message: error.message || 'Internal checkout processing failed.' });
  }
};

/**
 * 🔒 Verify Razorpay Payment Signature (SHA256 Hook)
 */
export const verifyPayment = async (req: Request, res: Response): Promise<any> => {
  try {
    const { rzpOrderId, rzpPaymentId, rzpSignature, orderId } = req.body;
    const result = await orderService.verifyPayment(rzpOrderId, rzpPaymentId, rzpSignature, orderId);
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Signature verification error:', error);
    res.status(400).json({ message: error.message || 'Failed to verify payment.' });
  }
};

/**
 * 📜 Get Logged-In User Orders (Order History)
 */
export const getUserOrders = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User unauthorized.' });
    }

    const orders = await orderService.getUserOrders(userId);
    res.status(200).json(orders);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * 💳 Secure Payment Retry session creator for pending orders
 */
export const retryOrderPayment = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const orderId = req.params.orderId as string;

    if (!userId) {
      return res.status(401).json({ message: 'User unauthorized.' });
    }

    const result = await orderService.retryOrderPayment(orderId, userId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Payment retry session error:', error);
    res.status(400).json({ message: error.message || 'Failed to initiate retry session.' });
  }
};

/**
 * 📦 Admin: Get All Store Orders
 */
export const getAllOrders = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'Admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    // Support pagination if needed
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const result = await orderService.getAllOrders(page, limit);
    
    // Ensure backwards compatibility: if no pagination filters were sent, return raw array expected by frontend
    if (page === undefined && limit === undefined) {
      return res.status(200).json(result.data);
    }
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch store orders.' });
  }
};

/**
 * 🔄 Admin: Update Order Fulfillment or Payment Status
 */
export const updateOrderStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'Admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const orderId = req.params.orderId as string;
    const { status, paymentStatus } = req.body;

    const result = await orderService.updateOrderStatus(orderId, status, paymentStatus);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to update order status.' });
  }
};

/**
 * ❌ Customer: Cancel Order (with Reason and automatic Stock Restoral)
 */
export const cancelOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const orderId = req.params.orderId as string;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'User unauthorized.' });
    }

    const userRole = (req as any).user?.role || 'Customer';
    const result = await orderService.cancelOrder(orderId, userId, userRole, reason);
    
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to cancel order.' });
  }
};

/**
 * 🔄 Customer: Request Order Return (with Reason)
 */
export const requestOrderReturn = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const orderId = req.params.orderId as string;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'User unauthorized.' });
    }

    const result = await orderService.requestOrderReturn(orderId, userId, reason);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to submit return request.' });
  }
};

/**
 * ⚖️ Admin: Approve or Reject Returns (with Stock Restoral on Approval)
 */
export const verifyOrderReturn = async (req: Request, res: Response): Promise<any> => {
  try {
    const userRole = (req as any).user?.role;
    if (userRole !== 'Admin') {
      return res.status(403).json({ message: 'Forbidden: Admin privilege required.' });
    }

    const orderId = req.params.orderId as string;
    const { action } = req.body; // 'Approve' or 'Reject'

    const result = await orderService.verifyOrderReturn(orderId, action);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to verify return request.' });
  }
};
