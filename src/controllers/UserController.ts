import type { Request, Response } from 'express';
import UserService from '../services/UserService.js';
import userRepository from '../repositories/UserRepository.js';

/**
 * UserController - HTTP layer only (SRP)
 * Handles request parsing and response formatting.
 * Delegates all business logic to UserService.
 */
const userService = new UserService(userRepository);

export const getUsers = async (_req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json(user);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await userService.updateUser(req.params.id as string, req.body);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const toggleBlockUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await userService.toggleBlockUser(req.params.id as string);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await userService.deleteUser(req.params.id as string);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
