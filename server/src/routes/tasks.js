import express from 'express';
import { z } from 'zod';
import { Task } from '../models/Task.js';
import { requireAuth } from '../middleware/auth.js';
import {
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

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200),
  description: z.string().max(2000).optional(),
  courseId: z.string().nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  completed: z.boolean().optional(),
});

const taskUpdateSchema = taskSchema.partial();

function toTaskDoc(data) {
  const doc = { ...data };
  if (data.dueDate !== undefined) doc.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  return doc;
}

// GET /api/v1/tasks — ?completed, ?courseId, ?dueBefore, ?dueAfter, ?priority
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter = { userId: req.user._id };
    const completed = parseBool(req.query.completed);
    if (completed !== undefined) filter.completed = completed;
    if (req.query.courseId) {
      if (!isObjectId(String(req.query.courseId))) {
        return res.status(400).json({ error: 'courseId is not a valid course.' });
      }
      filter.courseId = req.query.courseId;
    }
    if (req.query.priority) filter.priority = String(req.query.priority);
    if (req.query.dueBefore || req.query.dueAfter) {
      filter.dueDate = {};
      if (req.query.dueBefore) filter.dueDate.$lt = new Date(String(req.query.dueBefore));
      if (req.query.dueAfter) filter.dueDate.$gte = new Date(String(req.query.dueAfter));
    }
    const [tasks, total] = await Promise.all([
      Task.find(filter).sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(limit),
      Task.countDocuments(filter),
    ]);
    return res.json(pagedResponse(tasks, 'tasks', total, { page, limit }));
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/tasks — completing on create also stamps completedAt.
router.post('/', async (req, res, next) => {
  try {
    const data = parseBody(taskSchema, req, res);
    if (!data) return;
    const courseId = await resolveCourseId(data.courseId, req.user._id, res);
    if (courseId === undefined) return;
    const doc = toTaskDoc({ ...data, courseId });
    if (doc.completed) doc.completedAt = new Date();
    const task = await Task.create({ ...doc, userId: req.user._id });
    return res.status(201).json({ task });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/tasks/:id — 404 when it belongs to another user (no leak).
router.get('/:id', async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    return res.json({ task });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/v1/tasks/:id — completed=true stamps completedAt, false clears it.
router.put('/:id', async (req, res, next) => {
  try {
    const data = parseBody(taskUpdateSchema, req, res);
    if (!data) return;
    if (data.courseId !== undefined) {
      const courseId = await resolveCourseId(data.courseId, req.user._id, res);
      if (courseId === undefined) return;
      data.courseId = courseId;
    }
    const doc = toTaskDoc(data);
    if (data.completed === true) doc.completedAt = new Date();
    if (data.completed === false) doc.completedAt = null;
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      doc,
      { new: true, runValidators: true },
    );
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    return res.json({ task });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/v1/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
