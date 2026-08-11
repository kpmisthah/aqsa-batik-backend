import express from 'express';
import { getSliders, getActiveSliders, createSlider, updateSlider, deleteSlider } from '../controllers/HomeSliderController.js';
import { protect, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/active', getActiveSliders); // Public route for homepage
router.get('/', protect, authorize('Admin'), getSliders); // Admin route
router.post('/', protect, authorize('Admin'), createSlider);
router.put('/:id', protect, authorize('Admin'), updateSlider);
router.delete('/:id', protect, authorize('Admin'), deleteSlider);

export default router;
