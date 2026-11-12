import express from 'express';
import { z } from 'zod';
import { GpaRecord } from '../models/GpaRecord.js';
import { Course } from '../models/Course.js';
import { requireAuth } from '../middleware/auth.js';
import { computeGpa, DEFAULT_SCALE, GRADE_LETTERS } from '../gpa.js';
import {
  escapeRegExp,
  pagedResponse,
  parseBody,
  parsePagination,
  requireDb,
  resolveCourseId,
} from './common.js';

const router = express.Router();

router.use(requireAuth, requireDb);

const gpaRecordSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120),
  semester: z.string().trim().max(60).optional(),
  grade: z.enum(GRADE_LETTERS, { message: 'Grade must be one of A, A-, B+, B, B-, C+, C, D, F.' }),
  courseId: z.string().optional().nullable(),
  creditHours: z.number().min(0, 'Credit hours cannot be negative.').max(12).optional(),
});

const gpaRecordUpdateSchema = gpaRecordSchema.partial();

/**
 * Resolve the credit hours for a record: explicit creditHours win; otherwise
 * the linked course's creditHours are used. Returns the number, or sends a
 * 400 and returns undefined when neither is available.
 */
async function resolveCredits(data, userId, res) {
  if (data.creditHours !== undefined && data.creditHours !== null) return data.creditHours;
  if (data.courseId) {
    const course = await Course.findOne({ _id: data.courseId, userId });
    if (!course) {
      res.status(400).json({ error: 'courseId does not belong to your account.' });
      return undefined;
    }
    if (course.creditHours === undefined || course.creditHours === null) {
      res.status(400).json({ error: 'That course has no credit hours set — add credit hours to the record.' });
      return undefined;
    }
    return course.creditHours;
  }
  res.status(400).json({ error: 'Provide creditHours, or link a course that has credit hours.' });
  return undefined;
}

// GET /api/v1/gpa-records — list own records (?semester, ?search, pagination).
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter = { userId: req.user._id };
    if (req.query.semester) filter.semester = String(req.query.semester);
    if (req.query.search) {
      filter.title = { $regex: escapeRegExp(String(req.query.search)), $options: 'i' };
    }
    const [records, total] = await Promise.all([
      GpaRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      GpaRecord.countDocuments(filter),
    ]);
    return res.json(pagedResponse(records, 'records', total, { page, limit }));
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/gpa-records/compute — server-side credit-weighted GPA from the
// user's own records, using the user's own grading scale (default 4.0).
// The result is labelled an estimate: scales and policies differ by university.
// NOTE: this route must stay above /:id so "compute" is not read as an id.
router.get('/compute', async (req, res, next) => {
  try {
    const records = await GpaRecord.find({ userId: req.user._id }).lean();
    const scale = req.user.gradingScale || DEFAULT_SCALE;
    const result = computeGpa(records, scale);
    return res.json({
      ...result,
      recordCount: records.length,
      scale,
      estimate: true,
      note: 'Estimate only — universities use different grading scales and policies.',
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/gpa-records
router.post('/', async (req, res, next) => {
  try {
    const data = parseBody(gpaRecordSchema, req, res);
    if (!data) return;
    const courseId = await resolveCourseId(data.courseId, req.user._id, res);
    if (courseId === undefined) return;
    const creditHours = await resolveCredits(data, req.user._id, res);
    if (creditHours === undefined) return;
    const record = await GpaRecord.create({
      ...data,
      courseId,
      creditHours,
      userId: req.user._id,
    });
    return res.status(201).json({ record });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/gpa-records/:id — 404 when it belongs to another user.
router.get('/:id', async (req, res, next) => {
  try {
    const record = await GpaRecord.findOne({ _id: req.params.id, userId: req.user._id });
    if (!record) return res.status(404).json({ error: 'GPA record not found.' });
    return res.json({ record });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/v1/gpa-records/:id — partial update; credits re-resolve when the
// course link or creditHours change.
router.put('/:id', async (req, res, next) => {
  try {
    const data = parseBody(gpaRecordUpdateSchema, req, res);
    if (!data) return;
    const existing = await GpaRecord.findOne({ _id: req.params.id, userId: req.user._id });
    if (!existing) return res.status(404).json({ error: 'GPA record not found.' });
    if (data.courseId !== undefined) {
      const courseId = await resolveCourseId(data.courseId, req.user._id, res);
      if (courseId === undefined) return;
      data.courseId = courseId;
    }
    if (data.creditHours === undefined && data.courseId !== undefined) {
      const creditHours = await resolveCredits(
        { courseId: data.courseId, creditHours: undefined },
        req.user._id,
        res,
      );
      if (creditHours === undefined) return;
      data.creditHours = creditHours;
    }
    Object.assign(existing, data);
    await existing.save();
    return res.json({ record: existing });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/v1/gpa-records/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const record = await GpaRecord.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!record) return res.status(404).json({ error: 'GPA record not found.' });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
