import express from 'express';
import { getHomeContentSections, getHomeContentByKey, updateHomeContentByKey } from '../controllers/HomeContentController.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', getHomeContentSections);
router.get('/:key', getHomeContentByKey);

router.put('/:key', protect, authorize('Admin'), updateHomeContentByKey);

export default router;
