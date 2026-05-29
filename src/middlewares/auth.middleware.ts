import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'aqsha_access_token_secret_key_12345';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'Admin' | 'Wholesaler' | 'Customer';
  };
}

/**
 * Authentication Middleware - verifies the custom access token stored in HTTP-Only cookies
 */
export const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction): any => {
  const accessToken = req.cookies.accessToken;

  if (!accessToken) {
    return res.status(401).json({ message: 'Not authenticated. Please log in.' });
  }

  try {
    const decoded = jwt.verify(accessToken, JWT_ACCESS_SECRET) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Access token expired or invalid. Please re-authenticate.' });
  }
};

/**
 * Role-based Authorization Middleware
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access denied. Role '${req.user.role}' is not authorized.` });
    }

    next();
  };
};
