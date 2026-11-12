import express from 'express';
import { z } from 'zod';
import { Note } from '../models/Note.js';
import { requireAuth } from '../middleware/auth.js';
import {
  escapeRegExp,
  isObjectId,
  pagedResponse,
  parseBool,
  parseBody,
  parsePagination,
  requireDb,
  resolveCourseId,
} from './common.js';

const router = express.Router();

router.use(requireAuth, requireDb);

const noteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200),
  courseId: z.string().nullable().optional(),
  contentMarkdown: z.string().max(100000).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
});

const noteUpdateSchema = noteSchema.partial();

// GET /api/v1/notes — ?search (title/content), ?courseId, ?tag, ?pinned, ?archived
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter = { userId: req.user._id };
    const archived = parseBool(req.query.archived);
    if (archived !== undefined) filter.archived = archived;
    const pinned = parseBool(req.query.pinned);
    if (pinned !== undefined) filter.pinned = pinned;
    if (req.query.courseId) {
      if (!isObjectId(String(req.query.courseId))) {
        return res.status(400).json({ error: 'courseId is not a valid course.' });
      }
      filter.courseId = req.query.courseId;
    }
    if (req.query.tag) filter.tags = String(req.query.tag);
    if (req.query.search) {
      const pattern = { $regex: escapeRegExp(String(req.query.search)), $options: 'i' };
      filter.$or = [{ title: pattern }, { contentMarkdown: pattern }];
    }
    const [notes, total] = await Promise.all([
      Note.find(filter).sort({ pinned: -1, updatedAt: -1 }).skip(skip).limit(limit),
      Note.countDocuments(filter),
    ]);
    return res.json(pagedResponse(notes, 'notes', total, { page, limit }));
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/notes
router.post('/', async (req, res, next) => {
  try {
    const data = parseBody(noteSchema, req, res);
    if (!data) return;
    const courseId = await resolveCourseId(data.courseId, req.user._id, res);
    if (courseId === undefined) return;
    const note = await Note.create({ ...data, courseId, userId: req.user._id });
    return res.status(201).json({ note });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/notes/:id — 404 when it belongs to another user (no leak).
router.get('/:id', async (req, res, next) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.user._id });
    if (!note) return res.status(404).json({ error: 'Note not found.' });
    return res.json({ note });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/v1/notes/:id — also the autosave endpoint; returns updatedAt.
router.put('/:id', async (req, res, next) => {
  try {
    const data = parseBody(noteUpdateSchema, req, res);
    if (!data) return;
    if (data.courseId !== undefined) {
      const courseId = await resolveCourseId(data.courseId, req.user._id, res);
      if (courseId === undefined) return;
      data.courseId = courseId;
    }
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      data,
      { new: true, runValidators: true },
    );
    if (!note) return res.status(404).json({ error: 'Note not found.' });
    return res.json({ note });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/v1/notes/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!note) return res.status(404).json({ error: 'Note not found.' });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
