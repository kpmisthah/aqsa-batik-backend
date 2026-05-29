import express from 'express';
import { 
  createCheckoutSession, 
  verifyPayment, 
  getUserOrders, 
  retryOrderPayment, 
  getAllOrders, 
  updateOrderStatus,
  cancelOrder,
  requestOrderReturn,
  verifyOrderReturn
} from '../controllers/OrderController.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Apply auth protection to all order payment routes
router.use(protect);

router.post('/checkout', createCheckoutSession);
router.post('/verify', verifyPayment);
router.get('/history', getUserOrders);
router.post('/:orderId/retry', retryOrderPayment);

// Cancellation and Return requests (customer authenticated)
router.post('/:orderId/cancel', cancelOrder);
router.post('/:orderId/return', requestOrderReturn);

// Admin-only order management endpoints
router.get('/', getAllOrders);
router.put('/:orderId', updateOrderStatus);
router.post('/:orderId/verify-return', verifyOrderReturn);

export default router;
