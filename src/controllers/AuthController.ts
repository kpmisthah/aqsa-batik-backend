import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AuthService } from '../services/AuthService.js';
import userRepository from '../repositories/UserRepository.js';
import User from '../models/User.js';

const authService = new AuthService(userRepository);

/**
 * Sets Access and Refresh Tokens as HTTP-Only cookies
 */
const setTokenCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/**
 * Handshake and sync Clerk User session with MongoDB, returns HTTP-only cookies
 */
export const syncClerkSession = async (req: Request, res: Response): Promise<any> => {
  try {
    const { clerkId, email, name } = req.body;

    if (!clerkId || !email) {
      return res.status(400).json({ message: 'Clerk User ID and Email are required' });
    }

    const { user, accessToken, refreshToken } = await authService.syncClerkUser(clerkId, email, name);

    // Set HTTP-Only cookies
    setTokenCookies(res, accessToken, refreshToken);

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: (user as any).avatar,
        walletBalance: (user as any).walletBalance || 0,
        walletHistory: (user as any).walletHistory || [],
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error: any) {
    if (error.message === 'This account has been blocked.') {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Refreshes custom Access Token using HTTP-Only Refresh Token
 */
export const refreshSession = async (req: Request, res: Response): Promise<any> => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { user, accessToken, refreshToken } = await authService.refreshSession(token);

    // Re-issue cookies
    setTokenCookies(res, accessToken, refreshToken);

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: (user as any).avatar,
        walletBalance: (user as any).walletBalance || 0,
        walletHistory: (user as any).walletHistory || [],
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error: any) {
    if (error.message === 'Invalid or expired refresh token') {
      return res.status(403).json({ message: error.message });
    }
    if (error.message === 'User unauthorized') {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Clears Access and Refresh Token cookies
 */
export const logout = (_req: Request, res: Response): any => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

/**
 * Returns authenticated user profile by verifying HTTP-only Access Token
 */
export const getMe = async (req: Request, res: Response): Promise<any> => {
  try {
    const accessToken = req.cookies.accessToken;

    if (!accessToken) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await authService.getMe(accessToken);

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: (user as any).avatar,
        walletBalance: (user as any).walletBalance || 0,
        walletHistory: (user as any).walletHistory || [],
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error: any) {
    if (error.message === 'Access token expired or invalid') {
      return res.status(401).json({ message: error.message });
    }
    if (error.message === 'User not found or blocked') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Temporary registration. Stashes user in Redis/In-memory fallback and sends OTP.
 */
export const signup = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    await authService.signup(name, email, password);

    res.status(200).json({
      success: true,
      message: 'Verification OTP sent successfully! Please verify to complete your signup.',
      email,
    });
  } catch (error: any) {
    if (error.message === 'User already exists. Please login instead.') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Verifies OTP and registers user permanently in MongoDB
 */
export const verifyOtp = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP code are required' });
    }

    const { user, accessToken, refreshToken } = await authService.verifyOtp(email, otp);

    // Set Token cookies to automatically log the user in
    setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Account created and verified successfully!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: (user as any).avatar,
        walletBalance: (user as any).walletBalance || 0,
        walletHistory: (user as any).walletHistory || [],
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error: any) {
    if (error.message === 'Invalid or expired OTP. Please signup again.') {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === 'Incorrect OTP. Please check the code and try again.') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Authenticates user using email and password, setting local HTTP-Only cookies
 */
export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const { user, accessToken, refreshToken } = await authService.login(email, password);

    // Set Token cookies
    setTokenCookies(res, accessToken, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: (user as any).avatar,
        walletBalance: (user as any).walletBalance || 0,
        walletHistory: (user as any).walletHistory || [],
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error: any) {
    if (error.message === 'user not exist') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'This account has been blocked.') {
      return res.status(403).json({ message: error.message });
    }
    if (error.message === 'This account was created via social login. Please continue with Google.') {
      return res.status(400).json({ message: error.message });
    }
    if (error.message === 'Incorrect password') {
      return res.status(401).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * 👑 Special Admin Login - seeds admin credentials and responds with cookies
 */
export const adminLogin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if user exists in database
    let user = await User.findOne({ email: trimmedEmail });

    // Dynamic admin seeding if it doesn't exist yet
    if (!user && trimmedEmail === 'aqdaschhipa368@gmail.com') {
      console.log('🌱 Dynamic Admin Seeding: Creating aqdaschhipa368@gmail.com admin account...');
      const hashedPassword = await bcrypt.hash('Aqd@s1212', 10);
      user = await User.create({
        name: 'Aqda Admin',
        email: 'aqdaschhipa368@gmail.com',
        password: hashedPassword,
        role: 'Admin',
        status: 'Active',
        lastLogin: new Date().toISOString(),
        isBlocked: false,
      });
    }

    if (!user) {
      return res.status(404).json({ message: 'User does not exist' });
    }

    if (user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied: You are not authorized as an Admin.' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: 'This account has been blocked.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Update lastLogin
    user.lastLogin = new Date().toISOString();
    await user.save();

    // Sign Access and Refresh Tokens
    const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'aqsha_access_token_secret_key_12345';
    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'aqsha_refresh_token_secret_key_54321';

    const accessToken = jwt.sign(
      { id: user._id || user.id, email: user.email, role: user.role },
      JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user._id || user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Set Token cookies
    setTokenCookies(res, accessToken, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Admin logged in successfully!',
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: (user as any).avatar,
        walletBalance: (user as any).walletBalance || 0,
        walletHistory: (user as any).walletHistory || [],
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error during admin login.' });
  }
};
