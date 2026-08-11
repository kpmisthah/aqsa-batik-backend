import type { Request, Response } from 'express';
import HomeSlider from '../models/HomeSlider.js';

export const getSliders = async (req: Request, res: Response) => {
  try {
    const sliders = await HomeSlider.find().sort({ order: 1 });
    res.json(sliders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sliders', error });
  }
};

export const getActiveSliders = async (req: Request, res: Response) => {
  try {
    const sliders = await HomeSlider.find({ isActive: true }).sort({ order: 1 });
    res.json(sliders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching active sliders', error });
  }
};

export const createSlider = async (req: Request, res: Response) => {
  try {
    const newSlider = new HomeSlider(req.body);
    const savedSlider = await newSlider.save();
    res.status(201).json(savedSlider);
  } catch (error) {
    res.status(500).json({ message: 'Error creating slider', error });
  }
};

export const updateSlider = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedSlider = await HomeSlider.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedSlider) return res.status(404).json({ message: 'Slider not found' });
    res.json(updatedSlider);
  } catch (error) {
    res.status(500).json({ message: 'Error updating slider', error });
  }
};

export const deleteSlider = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deletedSlider = await HomeSlider.findByIdAndDelete(id);
    if (!deletedSlider) return res.status(404).json({ message: 'Slider not found' });
    res.json({ message: 'Slider deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting slider', error });
  }
};
