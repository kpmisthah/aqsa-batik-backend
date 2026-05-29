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
} from '../controllers/AuthController.js';

const router = express.Router();

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

export default router;
