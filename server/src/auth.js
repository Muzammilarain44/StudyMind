import jwt from 'jsonwebtoken';

export const COOKIE_NAME = 'studymind_token';
const TOKEN_EXPIRY = '7d';

let warnedDevSecret = false;

/**
 * JWT secret resolution.
 * - Production without JWT_SECRET: fail loudly (caller exits).
 * - Development/test without JWT_SECRET: use a dev-only default and warn
 *   once. The secret itself is never logged.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set (or too short). Set a long random JWT_SECRET before starting in production.');
  }
  if (!warnedDevSecret) {
    warnedDevSecret = true;
    console.warn(
      '[auth] WARNING: JWT_SECRET is not set — using a dev-only default. ' +
        'Never use this in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }
  return 'dev-only-insecure-secret-do-not-use-in-production-0000000000';
}

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, getJwtSecret(), {
    expiresIn: TOKEN_EXPIRY,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

export function publicUser(user) {
  if (!user) return null;
  if (typeof user.toPublicJSON === 'function') return user.toPublicJSON();
  const obj = { ...user };
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
}
