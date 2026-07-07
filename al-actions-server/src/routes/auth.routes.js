import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { verifyGoogleIdToken } from '../services/googleAuth.service.js';
import { upsertFromGoogleProfile } from '../services/users.repository.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

/**
 * Exchanges a Google ID token (from the mobile app's GoogleAuth plugin)
 * for this API's own session JWT. Domain restriction is enforced here,
 * server-side, regardless of what the client already checked.
 */
authRouter.post(
  '/google',
  asyncHandler(async (req, res) => {
    const { idToken } = req.body;
    const profile = await verifyGoogleIdToken(idToken);

    const user = await upsertFromGoogleProfile(profile);
    if (!user.active) {
      throw new HttpError(403, 'Your account has been deactivated. Contact an admin.');
    }

    const token = jwt.sign({ email: user.email }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    });

    res.json({ token, user });
  })
);

/** Resolves the current session token to a user — used for session restore on app boot. */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      active: req.user.active,
      photoUrl: req.user.photo_url
    });
  })
);
