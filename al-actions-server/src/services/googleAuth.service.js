import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/env.js';
import { HttpError } from '../utils/asyncHandler.js';

const client = new OAuth2Client(config.googleOAuthClientId);

/**
 * Verifies a Google ID token sent by the mobile app and enforces the
 * airliquide.com Workspace domain restriction server-side (never trust
 * the client-side check alone).
 * Returns { email, name, photoUrl }.
 */
export async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new HttpError(400, 'Missing idToken');
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: config.googleOAuthClientId
    });
  } catch {
    throw new HttpError(401, 'Invalid Google token');
  }

  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) {
    throw new HttpError(401, 'Google account email is not verified');
  }

  const domain = payload.hd || payload.email.split('@')[1];
  if (domain?.toLowerCase() !== config.allowedGoogleDomain.toLowerCase()) {
    throw new HttpError(
      403,
      `Sign in with your @${config.allowedGoogleDomain} account. Personal Google accounts aren't allowed.`
    );
  }

  return {
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email,
    photoUrl: payload.picture
  };
}
