import type { Request, Response } from 'express';
import HomeContent from '../models/HomeContent.js';

export const getHomeContentSections = async (req: Request, res: Response) => {
  try {
    const sections = await HomeContent.find();
    res.json(sections);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching home content', error });
  }
};

export const getHomeContentByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const section = await HomeContent.findOne({ sectionKey: key } as any);
    if (!section) {
      // Not an error: this section just hasn't been customized from the
      // admin panel yet, so the caller should use its own fallback content.
      return res.status(200).json({ sectionKey: key, data: null });
    }
    res.json(section);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching section', error });
  }
};

export const updateHomeContentByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { data } = req.body;

    if (data === undefined) {
      return res.status(400).json({ message: 'data is required' });
    }

    const section = await HomeContent.findOneAndUpdate(
      { sectionKey: key } as any,
      { sectionKey: key, data } as any,
      { new: true, upsert: true } as any
    );

    res.json(section);
  } catch (error) {
    res.status(500).json({ message: 'Error updating section', error });
  }
};
