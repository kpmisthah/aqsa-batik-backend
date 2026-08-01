import { type Request, type Response } from 'express';
import WishlistItem from '../models/WishlistItem.js';
import Product from '../models/Product.js';

export const toggleWishlist = async (req: Request, res: Response) => {
  try {
    const { productId } = req.body;
    const userId = (req as any).user.id;

    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const existing = await WishlistItem.findOne({ user: userId, product: productId });
    
    if (existing) {
      await WishlistItem.findByIdAndDelete(existing._id);
      return res.status(200).json({ message: 'Removed from wishlist', isWishlisted: false, productId });
    } else {
      await WishlistItem.create({ user: userId, product: productId });
      return res.status(201).json({ message: 'Added to wishlist', isWishlisted: true, productId });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to toggle wishlist' });
  }
};

export const getWishlist = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;

    const total = await WishlistItem.countDocuments({ user: userId });
    
    const items = await WishlistItem.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('product');

    const validItems = items.filter(item => item.product != null);
    
    res.status(200).json({
      items: validItems,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch wishlist' });
  }
};

export const getWishlistIds = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const items = await WishlistItem.find({ user: userId }).select('product').lean();
    const productIds = items.map(item => item.product.toString());

    res.status(200).json(productIds);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch wishlist IDs' });
  }
};
