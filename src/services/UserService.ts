import type { IUserRepository } from '../interfaces/IUserRepository.js';
import type { IUser, CreateUserDTO, UpdateUserDTO } from '../types/user.types.js';

/**
 * UserService - Business logic layer (SRP)
 * Depends on IUserRepository interface, not the concrete class (DIP).
 */
class UserService {
  constructor(private readonly userRepository: IUserRepository) {}

  async getAllUsers(): Promise<IUser[]> {
    const result = await this.userRepository.findAll();
    return result.data;
  }

  async getUserById(id: string): Promise<IUser | null> {
    return await this.userRepository.findById(id);
  }

  async createUser(data: CreateUserDTO): Promise<IUser> {
    return await this.userRepository.create(data);
  }

  async updateUser(id: string, data: UpdateUserDTO): Promise<IUser | null> {
    return await this.userRepository.update(id, data);
  }

  async toggleBlockUser(id: string): Promise<IUser | null> {
    const user = await this.userRepository.findById(id);
    if (!user) return null;
    return await this.userRepository.update(id, {
      isBlocked: !user.isBlocked,
      status: !user.isBlocked ? 'Blocked' : 'Active',
    });
  }

  async deleteUser(id: string): Promise<IUser | null> {
    return await this.userRepository.delete(id);
  }
}

export default UserService;
