import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { query } from '../db/pool.js';
import { HttpError } from '../utils/asyncHandler.js';

/** Verifies the session bearer token and attaches req.user (the full users row). */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new HttpError(401, 'Missing or malformed Authorization header');
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw new HttpError(401, 'Session expired or invalid, please sign in again');
    }

    const { rows } = await query(
      'SELECT email, name, role, active, photo_url FROM users WHERE email = $1',
      [payload.email]
    );
    const user = rows[0];

    if (!user) {
      throw new HttpError(401, 'Account not found');
    }
    if (!user.active) {
      throw new HttpError(403, 'Your account has been deactivated. Contact an admin.');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Route guard for admin-only endpoints. Must run after requireAuth. */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(new HttpError(403, 'Admin access required'));
  }
  next();
}
