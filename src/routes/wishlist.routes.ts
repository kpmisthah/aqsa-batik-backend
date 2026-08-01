import express from 'express';
import { toggleWishlist, getWishlist, getWishlistIds } from '../controllers/WishlistController.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use(protect); // All routes require login

router.post('/toggle', toggleWishlist);
router.get('/', getWishlist);
router.get('/ids', getWishlistIds);

export default router;
