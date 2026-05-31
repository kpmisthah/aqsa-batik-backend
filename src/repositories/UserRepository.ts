import User from '../models/User.js';
import type { IUserRepository } from '../interfaces/IUserRepository.js';
import type { IUser, CreateUserDTO, UpdateUserDTO } from '../types/user.types.js';

import type { PaginatedResult } from '../interfaces/IBaseRepository.js';

/**
 * Concrete implementation of IUserRepository using Mongoose (DIP)
 */
class UserRepository implements IUserRepository {
  async findAll(page?: number, limit?: number, search?: string): Promise<PaginatedResult<IUser>> {
    const query: any = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }

    if (page === undefined || limit === undefined) {
      const data = await User.find(query).sort({ createdAt: -1 });
      const total = data.length;
      return {
        data,
        total,
        page: 1,
        limit: total,
        totalPages: 1
      };
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      User.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(query)
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<IUser | null> {
    return await User.findById(id);
  }

  async create(userData: CreateUserDTO): Promise<IUser> {
    const user = new User(userData);
    return await user.save();
  }

  async update(id: string, updateData: UpdateUserDTO): Promise<IUser | null> {
    return await User.findByIdAndUpdate(id, updateData, { new: true });
  }

  async delete(id: string): Promise<IUser | null> {
    return await User.findByIdAndDelete(id);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email });
  }

  async findByClerkId(clerkId: string): Promise<IUser | null> {
    return await User.findOne({ clerkId });
  }

  async findByEmailOrClerkId(email: string, clerkId: string): Promise<IUser | null> {
    return await User.findOne({ $or: [{ clerkId }, { email }] });
  }
}

export default new UserRepository();
