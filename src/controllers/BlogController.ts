import type { Request, Response } from 'express';
import blogRepository from '../repositories/BlogRepository.js';
import slugify from 'slugify';

export const getBlogs = async (req: Request, res: Response): Promise<any> => {
  try {
    const admin = req.query.admin === 'true';
    const blogs = await blogRepository.findAll(admin);
    res.status(200).json({ data: blogs });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getBlogById = async (req: Request, res: Response): Promise<any> => {
  try {
    const blog = await blogRepository.findById(req.params.id as string);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.status(200).json(blog);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getBlogBySlug = async (req: Request, res: Response): Promise<any> => {
  try {
    const blog = await blogRepository.findBySlug(req.params.slug as string);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.status(200).json(blog);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createBlog = async (req: Request, res: Response): Promise<any> => {
  try {
    const data = req.body;
    if (!data.slug && data.title) {
      data.slug = slugify(data.title, { lower: true, strict: true });
    }
    const blog = await blogRepository.create(data);
    res.status(201).json(blog);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateBlog = async (req: Request, res: Response): Promise<any> => {
  try {
    const data = req.body;
    if (data.title && !data.slug) {
      data.slug = slugify(data.title, { lower: true, strict: true });
    }
    const blog = await blogRepository.update(req.params.id as string, data);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.status(200).json(blog);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteBlog = async (req: Request, res: Response): Promise<any> => {
  try {
    const blog = await blogRepository.delete(req.params.id as string);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.status(200).json({ message: 'Blog deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
