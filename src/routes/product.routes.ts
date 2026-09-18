import express from 'express';
import { getProducts, getProductById, createProduct, updateProduct, toggleBlockProduct, deleteProduct, createBulkProducts, bulkUpdateInventory, getCategories } from '../controllers/ProductController.js';

const router = express.Router();

router.route('/').get(getProducts).post(createProduct);
router.route('/bulk').post(createBulkProducts);
router.route('/inventory').put(bulkUpdateInventory);
router.route('/categories').get(getCategories);
router.route('/:id').get(getProductById).put(updateProduct).delete(deleteProduct);
router.route('/:id/toggle-block').patch(toggleBlockProduct);

export default router;
