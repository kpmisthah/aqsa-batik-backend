import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { IUserRepository } from '../interfaces/IUserRepository.js';
import type { IUser } from '../types/user.types.js';
import { setCache, getCache, delCache } from './redis.service.js';
import { sendOtpEmail, sendResetPasswordOtpEmail } from './email.service.js';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'aqsha_access_token_secret_key_12345';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'aqsha_refresh_token_secret_key_54321';

export class AuthService {
  constructor(private readonly userRepository: IUserRepository) { }

  /**
   * Helper to sign access and refresh tokens
   */
  private generateTokens(user: IUser) {
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Handshake and sync Clerk User session with MongoDB
   */
  async syncClerkUser(clerkId: string, email: string, name?: string): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    // Find user or create a new one
    let user = await this.userRepository.findByEmailOrClerkId(email, clerkId);

    if (!user) {
      const finalName = name || email.split('@')[0] || '';
      user = await this.userRepository.create({
        clerkId,
        email,
        name: finalName,
        role: 'Customer',
        status: 'Active',
        lastLogin: new Date().toISOString(),
      });
    } else {
      // Update Clerk ID & lastLogin details if already existing
      user = await this.userRepository.update(user.id!, {
        clerkId,
        lastLogin: new Date().toISOString(),
      }) as IUser;
    }

    if (user.isBlocked) {
      throw new Error('Your account has been blocked by the admin. Please contact support.');
    }

    const tokens = this.generateTokens(user);
    return { user, ...tokens };
  }

  /**
   * General OAuth login handler (for custom Google/Facebook auth)
   */
  async oauthLogin(
    email: string,
    name: string,
    avatar: string | null,
    providerId: string
  ): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    // Find user by email or by providerId stored in clerkId
    let user = await this.userRepository.findByEmailOrClerkId(email, providerId);

    if (!user) {
      throw new Error('Account not found. Please sign up first to use Google Login.');
    }

    // Update details
    const updates: any = {
      lastLogin: new Date().toISOString(),
    };
    if (!user.clerkId) updates.clerkId = providerId;
    if (avatar && !user.avatar) updates.avatar = avatar;
    
    user = await this.userRepository.update(user.id!, updates) as IUser;

    if (user.isBlocked) {
      throw new Error('Your account has been blocked by the admin. Please contact support.');
    }

    const tokens = this.generateTokens(user);
    return { user, ...tokens };
  }

  /**
   * Refreshes access token using Refresh Token
   */
  async refreshSession(refreshToken: string): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    return new Promise((resolve, reject) => {
      jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err: any, decoded: any) => {
        if (err) {
          return reject(new Error('Invalid or expired refresh token'));
        }

        try {
          const user = await this.userRepository.findById(decoded.id);
          if (!user || user.isBlocked) {
            return reject(new Error('User unauthorized'));
          }

          const tokens = this.generateTokens(user);
          resolve({ user, ...tokens });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Returns authenticated user profile by verifying Access Token
   */
  async getMe(accessToken: string): Promise<IUser> {
    return new Promise((resolve, reject) => {
      jwt.verify(accessToken, JWT_ACCESS_SECRET, async (err: any, decoded: any) => {
        if (err) {
          return reject(new Error('Access token expired or invalid'));
        }

        try {
          const user = await this.userRepository.findById(decoded.id);
          if (!user || user.isBlocked) {
            return reject(new Error('User not found or blocked'));
          }

          resolve(user);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Temporary registration. Stashes user in cache and sends OTP.
   */
  async signup(name: string, email: string, password: string): Promise<void> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists. Please login instead.');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save in Redis/In-memory cache for 10 minutes (600 seconds)
    const cacheKey = `signup:${email}`;
    const cacheData = { name, email, password: hashedPassword, otp };
    await setCache(cacheKey, JSON.stringify(cacheData), 600);

    // Send verification email
    const emailResult = await sendOtpEmail(email, otp, name);
    console.log(emailResult), 'result of the otp';
    if (!emailResult) {
      throw new Error('Failed to send OTP verification email. Please try again.');
    }
  }

  /**
   * Verifies OTP and registers user permanently in MongoDB
   */
  async verifyOtp(email: string, otp: string): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    // Get from Redis/In-memory cache
    const cacheKey = `signup:${email}`;
    const cachedDataStr = await getCache(cacheKey);

    if (!cachedDataStr) {
      throw new Error('Invalid or expired OTP. Please signup again.');
    }

    const cachedData = JSON.parse(cachedDataStr);

    if (cachedData.otp !== otp) {
      throw new Error('Incorrect OTP. Please check the code and try again.');
    }

    // Create user in MongoDB
    const user = await this.userRepository.create({
      name: cachedData.name,
      email: cachedData.email,
      password: cachedData.password,
      role: 'Customer',
      status: 'Active',
      lastLogin: new Date().toISOString(),
      isBlocked: false,
    });

    // Remove from cache
    await delCache(cacheKey);

    const tokens = this.generateTokens(user);
    return { user, ...tokens };
  }

  /**
   * Authenticates user using email and password
   */
  async login(email: string, password: string): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    // Check if user exists
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('user not exist');
    }

    if (user.isBlocked) {
      throw new Error('Your account has been blocked by the admin. Please contact support.');
    }

    // Check if user has password
    if (!user.password) {
      throw new Error('This account was created via social login. Please continue with Google.');
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Incorrect password');
    }

    // Update lastLogin
    const updatedUser = await this.userRepository.update(user.id!, {
      lastLogin: new Date().toISOString(),
    }) as IUser;

    const tokens = this.generateTokens(updatedUser);
    return { user: updatedUser, ...tokens };
  }

  /**
   * Generates a password reset OTP and sends it via email
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('user not exist');
    }

    if (user.isBlocked) {
      throw new Error('Your account has been blocked by the admin. Please contact support.');
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Cache the OTP for 10 minutes (600 seconds)
    const cacheKey = `reset-otp:${email}`;
    await setCache(cacheKey, JSON.stringify({ otp, email }), 600);

    // Send the password reset email
    const emailResult = await sendResetPasswordOtpEmail(email, otp, user.name);
    if (!emailResult) {
      throw new Error('Failed to send password reset OTP. Please try again.');
    }
  }

  /**
   * Verifies the password reset OTP and flags the email as verified for reset
   */
  async verifyResetOtp(email: string, otp: string): Promise<void> {
    const cacheKey = `reset-otp:${email}`;
    const cachedDataStr = await getCache(cacheKey);

    if (!cachedDataStr) {
      throw new Error('Invalid or expired OTP. Please check the code or request a new one.');
    }

    const cachedData = JSON.parse(cachedDataStr);

    if (cachedData.otp !== otp) {
      throw new Error('Incorrect OTP. Please check the code and try again.');
    }

    // Mark as verified for reset (expires in 10 minutes)
    const verifiedKey = `reset-verified:${email}`;
    await setCache(verifiedKey, 'true', 600);

    // Remove the OTP cache key
    await delCache(cacheKey);
  }

  /**
   * Resets the user's password if the email has been verified via OTP
   */
  async resetPassword(email: string, password: string): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    // Check if verified via OTP
    const verifiedKey = `reset-verified:${email}`;
    const isVerified = await getCache(verifiedKey);

    if (!isVerified || isVerified !== 'true') {
      throw new Error('OTP verification is required before resetting your password.');
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('user not exist');
    }

    if (user.isBlocked) {
      throw new Error('Your account has been blocked by the admin. Please contact support.');
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password in MongoDB
    const updatedUser = await this.userRepository.update(user.id!, {
      password: hashedPassword,
      lastLogin: new Date().toISOString()
    }) as IUser;

    // Delete verified flag cache
    await delCache(verifiedKey);

    // Automatically log the user in
    const tokens = this.generateTokens(updatedUser);
    return { user: updatedUser, ...tokens };
  }
}
