import express from 'express';
import { z } from 'zod';
import { Course } from '../models/Course.js';
import { Note } from '../models/Note.js';
import { Task } from '../models/Task.js';
import { Quiz } from '../models/Quiz.js';
import { FlashcardDeck } from '../models/FlashcardDeck.js';
import { GpaRecord } from '../models/GpaRecord.js';
import { requireAuth } from '../middleware/auth.js';
import {
  escapeRegExp,
  pagedResponse,
  parseBool,
  parseBody,
  parsePagination,
  requireDb,
} from './common.js';

const router = express.Router();

router.use(requireAuth, requireDb);

const courseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120),
  code: z.string().trim().max(20).optional(),
  semester: z.string().trim().min(1, 'Semester is required.').max(60),
  colour: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be a hex colour like #4F46E5.')
    .optional(),
  creditHours: z.number().min(0).max(12).optional(),
  archived: z.boolean().optional(),
});

const courseUpdateSchema = courseSchema.partial();

// GET /api/v1/courses — list own courses (?archived, ?semester, ?search, pagination)
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter = { userId: req.user._id };
    const archived = parseBool(req.query.archived);
    if (archived !== undefined) filter.archived = archived;
    if (req.query.semester) filter.semester = String(req.query.semester);
    if (req.query.search) {
      filter.title = { $regex: escapeRegExp(String(req.query.search)), $options: 'i' };
    }
    const [courses, total] = await Promise.all([
      Course.find(filter).sort({ archived: 1, createdAt: -1 }).skip(skip).limit(limit),
      Course.countDocuments(filter),
    ]);
    return res.json(pagedResponse(courses, 'courses', total, { page, limit }));
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/courses
router.post('/', async (req, res, next) => {
  try {
    const data = parseBody(courseSchema, req, res);
    if (!data) return;
    const course = await Course.create({ ...data, userId: req.user._id });
    return res.status(201).json({ course });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/courses/:id — 404 when it belongs to another user (no leak).
router.get('/:id', async (req, res, next) => {
  try {
    const course = await Course.findOne({ _id: req.params.id, userId: req.user._id });
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    return res.json({ course });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/v1/courses/:id
router.put('/:id', async (req, res, next) => {
  try {
    const data = parseBody(courseUpdateSchema, req, res);
    if (!data) return;
    const course = await Course.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      data,
      { new: true, runValidators: true },
    );
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    return res.json({ course });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/v1/courses/:id
// The course's notes, tasks, quizzes, decks and GPA records are kept —
// only their link to this course is cleared, so nothing the user wrote
// is lost when a course is removed (Phase 6 data-integrity fix).
router.delete('/:id', async (req, res, next) => {
  try {
    const course = await Course.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    const unlink = { userId: req.user._id, courseId: course._id };
    await Promise.all([
      Note.updateMany(unlink, { $set: { courseId: null } }),
      Task.updateMany(unlink, { $set: { courseId: null } }),
      Quiz.updateMany(unlink, { $set: { courseId: null } }),
      FlashcardDeck.updateMany(unlink, { $set: { courseId: null } }),
      GpaRecord.updateMany(unlink, { $set: { courseId: null } }),
    ]);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
