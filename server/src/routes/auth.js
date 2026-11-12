import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/User.js';
import { clearAuthCookie, publicUser, setAuthCookie, signToken } from '../auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Tight brute-force limit on register/login only (10 per 15 min / IP).
// /me, /logout and /change-password need a valid session already, so they
// are not counted here — otherwise a normal session flow hits the cap.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
});

// Auth needs the database. Answer 503 immediately when it is down instead
// of hanging on Mongoose's command buffer or faking a success.
router.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database unavailable. Please try again later.' });
  }
  return next();
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  password: z.string().min(1, 'Password is required.').max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.').max(128),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.').max(128),
});

function parseBody(schema, req, res) {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues[0]?.message || 'Invalid input.';
    res.status(400).json({ error: message });
    return null;
  }
  return result.data;
}

// POST /api/v1/auth/register
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const data = parseBody(registerSchema, req, res);
    if (!data) return;
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({
      name: data.name,
      email: data.email,
      passwordHash,
    });
    setAuthCookie(res, signToken(user));
    return res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    // Race on the unique email index: report as 409, not 500.
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return next(err);
  }
});

// POST /api/v1/auth/login — generic message on failure (no user enumeration).
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const data = parseBody(loginSchema, req, res);
    if (!data) return;
    const user = await User.findOne({ email: data.email });
    const invalid = () => res.status(401).json({ error: 'Email or password is incorrect.' });
    if (!user) return invalid();
    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) return invalid();
    setAuthCookie(res, signToken(user));
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

// POST /api/v1/auth/change-password
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const data = parseBody(changePasswordSchema, req, res);
    if (!data) return;
    const ok = await bcrypt.compare(data.currentPassword, req.user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    req.user.passwordHash = await bcrypt.hash(data.newPassword, 12);
    await req.user.save();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
