import express from 'express';
import { getBanners, getBannerByPage, updateBanner } from '../controllers/BannerController.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', getBanners);
router.get('/:page', getBannerByPage);

router.put('/:page', protect, authorize('Admin'), updateBanner);

export default router;
