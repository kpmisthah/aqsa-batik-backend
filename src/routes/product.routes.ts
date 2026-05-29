import express from 'express';
import { getProducts, getProductById, createProduct, updateProduct, toggleBlockProduct, deleteProduct } from '../controllers/ProductController.js';

const router = express.Router();

router.route('/').get(getProducts).post(createProduct);
router.route('/:id').get(getProductById).put(updateProduct).delete(deleteProduct);
router.route('/:id/toggle-block').patch(toggleBlockProduct);

export default router;
