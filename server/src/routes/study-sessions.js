import express from 'express';
import { z } from 'zod';
import { StudySession } from '../models/StudySession.js';
import { requireAuth } from '../middleware/auth.js';
import { pagedResponse, parseBody, parsePagination, requireDb } from './common.js';

const router = express.Router();

router.use(requireAuth, requireDb);

const sessionSchema = z.object({
  type: z.enum(['focus', 'break']).optional().default('focus'),
  plannedMinutes: z.number().int().min(1).max(240).optional().default(25),
  clientKey: z.string().trim().min(1, 'clientKey is required.').max(100),
});

const completeSchema = z.object({
  actualMinutes: z.number().int().min(0).max(240).optional(),
});

// POST /api/v1/study-sessions — start a session. Idempotent on clientKey:
// a retry (e.g. after a tab refresh) returns the existing session with
// duplicate: true instead of creating a second one, so focus time is never
// double-counted.
router.post('/', async (req, res, next) => {
  try {
    const data = parseBody(sessionSchema, req, res);
    if (!data) return;
    const existing = await StudySession.findOne({ userId: req.user._id, clientKey: data.clientKey });
    if (existing) {
      return res.status(200).json({ session: existing, duplicate: true });
    }
    const session = await StudySession.create({ ...data, userId: req.user._id });
    return res.status(201).json({ session, duplicate: false });
  } catch (err) {
    // A concurrent retry can hit the unique index; return the winner.
    if (err.code === 11000) {
      const existing = await StudySession.findOne({
        userId: req.user._id,
        clientKey: req.body?.clientKey,
      });
      if (existing) return res.status(200).json({ session: existing, duplicate: true });
    }
    return next(err);
  }
});

// GET /api/v1/study-sessions — session history, newest first.
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter = { userId: req.user._id };
    if (req.query.status) {
      if (!['active', 'completed', 'abandoned'].includes(req.query.status)) {
        return res.status(400).json({ error: 'status must be active, completed or abandoned.' });
      }
      filter.status = req.query.status;
    }
    if (req.query.type) {
      if (!['focus', 'break'].includes(req.query.type)) {
        return res.status(400).json({ error: 'type must be focus or break.' });
      }
      filter.type = req.query.type;
    }
    const [sessions, total] = await Promise.all([
      StudySession.find(filter).sort({ startedAt: -1 }).skip(skip).limit(limit),
      StudySession.countDocuments(filter),
    ]);
    return res.json(pagedResponse(sessions, 'sessions', total, { page, limit }));
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/study-sessions/summary — real totals from stored sessions.
router.get('/summary', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const [completed, active] = await Promise.all([
      StudySession.find({ userId, type: 'focus', status: 'completed' }).lean(),
      StudySession.findOne({ userId, status: 'active' }).sort({ startedAt: -1 }).lean(),
    ]);
    const sumMinutes = (list) => list.reduce((s, x) => s + (x.actualMinutes ?? 0), 0);
    const today = completed.filter((s) => s.completedAt && new Date(s.completedAt) >= startOfToday);
    return res.json({
      completedFocusSessions: completed.length,
      totalFocusMinutes: sumMinutes(completed),
      focusMinutesToday: sumMinutes(today),
      focusSessionsToday: today.length,
      activeSession: active || null,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/study-sessions/:id/complete — finish an active session.
// A session can be completed exactly once: completing it again is 409.
router.post('/:id/complete', async (req, res, next) => {
  try {
    const data = parseBody(completeSchema, req, res);
    if (!data) return;
    const session = await StudySession.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.status !== 'active') {
      return res
        .status(409)
        .json({ error: `This session is already ${session.status} and cannot be completed again.` });
    }
    session.status = 'completed';
    session.completedAt = new Date();
    session.actualMinutes = data.actualMinutes ?? session.plannedMinutes;
    await session.save();
    return res.json({ session });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/study-sessions/:id/abandon — give up an active session.
router.post('/:id/abandon', async (req, res, next) => {
  try {
    const session = await StudySession.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.status !== 'active') {
      return res.status(409).json({ error: `This session is already ${session.status}.` });
    }
    session.status = 'abandoned';
    session.completedAt = new Date();
    session.actualMinutes = 0;
    await session.save();
    return res.json({ session });
  } catch (err) {
    return next(err);
  }
});

export default router;
