import { COOKIE_NAME, verifyToken } from '../auth.js';
import { User } from '../models/User.js';

/** Require a valid studymind_token cookie. Loads the user, 401 otherwise. */
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    }
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ error: 'Session is invalid or expired. Please log in again.' });
    }
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Require one of the given roles. Use after requireAuth. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    return next();
  };
}
