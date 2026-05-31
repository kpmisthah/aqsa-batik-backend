export type UserRole = 'Admin' | 'Wholesaler' | 'Customer';
export type UserStatus = 'Active' | 'Inactive' | 'Blocked' | 'Pending';

export interface IUser {
  id?: string;
  clerkId?: string | null;
  name: string;
  email: string;
  password?: string | null;
  role: UserRole;
  status: UserStatus;
  lastLogin: string;
  isBlocked: boolean;
  avatar?: string | null;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  password?: string | null;
  clerkId?: string | null;
  role?: UserRole;
  status?: UserStatus;
  lastLogin?: string;
  isBlocked?: boolean;
  avatar?: string | null;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  password?: string | null;
  clerkId?: string | null;
  role?: UserRole;
  status?: UserStatus;
  lastLogin?: string;
  isBlocked?: boolean;
  avatar?: string | null;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
}


