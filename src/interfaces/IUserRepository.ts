import type { IBaseRepository } from './IBaseRepository.js';
import type { IUser, CreateUserDTO, UpdateUserDTO } from '../types/user.types.js';

/**
 * User-specific repository interface (ISP)
 * Extends the base with any user-specific query methods.
 */
export interface IUserRepository extends IBaseRepository<IUser, CreateUserDTO, UpdateUserDTO> {
  findByEmail(email: string): Promise<IUser | null>;
  findByClerkId(clerkId: string): Promise<IUser | null>;
  findByEmailOrClerkId(email: string, clerkId: string): Promise<IUser | null>;
}
