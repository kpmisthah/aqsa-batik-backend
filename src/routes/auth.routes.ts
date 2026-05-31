import express from 'express';
import {
  syncClerkSession,
  refreshSession,
  logout,
  getMe,
  signup,
  verifyOtp,
  login,
  adminLogin,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  googleAuthRedirect,
  googleAuthCallback,
} from '../controllers/AuthController.js';

const router = express.Router();

// Custom Google OAuth Routes
router.get('/google', googleAuthRedirect);
router.get('/google/callback', googleAuthCallback);

/**
 * @route   POST /api/auth/sync
 * @desc    Handshake and sync Clerk User session with MongoDB, returns HTTP-only cookies
 */
router.post('/sync', syncClerkSession);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refreshes custom Access Token using HTTP-Only Refresh Token
 */
router.post('/refresh', refreshSession);

/**
 * @route   POST /api/auth/logout
 * @desc    Clears Access and Refresh Token cookies
 */
router.post('/logout', logout);

/**
 * @route   GET /api/auth/me
 * @desc    Returns authenticated user profile by verifying HTTP-only Access Token
 */
router.get('/me', getMe);

/**
 * @route   POST /api/auth/signup
 * @desc    Temporary registration. Stashes user in Redis/In-memory fallback and sends OTP.
 */
router.post('/signup', signup);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verifies OTP and registers user permanently in MongoDB
 */
router.post('/verify-otp', verifyOtp);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticates user using email and password, setting local HTTP-Only cookies
 */
router.post('/login', login);

/**
 * @route   POST /api/auth/admin-login
 * @desc    Special Admin Login - seeds admin credentials and responds with cookies
 */
router.post('/admin-login', adminLogin);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Initiates forgot password flow - sends OTP if email exists
 */
router.post('/forgot-password', forgotPassword);

/**
 * @route   POST /api/auth/verify-reset-otp
 * @desc    Verifies forgot password OTP and stores verification flag in cache
 */
router.post('/verify-reset-otp', verifyResetOtp);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Resets the password and automatically logs the user in if OTP was verified
 */
router.post('/reset-password', resetPassword);

export default router;
