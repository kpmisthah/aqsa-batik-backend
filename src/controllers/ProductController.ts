import type { Request, Response } from 'express';
import ProductService from '../services/ProductService.js';
import productRepository from '../repositories/ProductRepository.js';

/**
 * ProductController - HTTP layer only (SRP)
 * Handles request parsing and response formatting.
 * Delegates all business logic to ProductService.
 */
const productService = new ProductService(productRepository);

export const getProducts = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const admin = req.query.admin === 'true';
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const sort = req.query.sort as string | undefined;
    const minPrice = req.query.minPrice ? parseInt(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice as string) : undefined;

    const result = await productService.getAllProducts(page, limit, admin, category, search, sort, minPrice, maxPrice);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<any> => {
  try {
    const product = await productService.getProductById(req.params.id as string);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(product);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const product = await productService.createProduct(req.body);
    res.status(201).json(product);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const createBulkProducts = async (req: Request, res: Response): Promise<any> => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ message: 'Expected an array of products' });

    const results = await productService.createBulkProducts(items);
    res.status(201).json({ message: 'Bulk insert successful', count: results.length });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<any> => {
  try {
    const product = await productService.updateProduct(req.params.id as string, req.body);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(product);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const toggleBlockProduct = async (req: Request, res: Response): Promise<any> => {
  try {
    const product = await productService.toggleBlockProduct(req.params.id as string);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(product);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<any> => {
  try {
    const product = await productService.deleteProduct(req.params.id as string);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const bulkUpdateInventory = async (req: Request, res: Response): Promise<any> => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) return res.status(400).json({ message: 'Expected an array of updates' });

    await productService.bulkUpdateInventory(updates);
    res.status(200).json({ message: 'Inventory updated successfully' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
