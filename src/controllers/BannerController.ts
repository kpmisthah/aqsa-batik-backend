import type { Request, Response } from 'express';
import Banner from '../models/Banner.js';

export const getBanners = async (req: Request, res: Response) => {
  try {
    const banners = await Banner.find();
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching banners', error });
  }
};

export const getBannerByPage = async (req: Request, res: Response) => {
  try {
    const { page } = req.params;
    const banner = await Banner.findOne({ page } as any);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching banner', error });
  }
};

export const updateBanner = async (req: Request, res: Response) => {
  try {
    const { page } = req.params;
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ message: 'imageUrl is required' });
    }

    const banner = await Banner.findOneAndUpdate(
      { page } as any,
      { imageUrl } as any,
      { new: true, upsert: true } as any
    );
    
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: 'Error updating banner', error });
  }
};

