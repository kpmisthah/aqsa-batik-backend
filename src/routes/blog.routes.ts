import express from 'express';
import { getBlogs, getBlogById, getBlogBySlug, createBlog, updateBlog, deleteBlog } from '../controllers/BlogController.js';

const router = express.Router();

router.route('/').get(getBlogs).post(createBlog);
router.route('/slug/:slug').get(getBlogBySlug);
router.route('/:id').get(getBlogById).put(updateBlog).delete(deleteBlog);

export default router;
