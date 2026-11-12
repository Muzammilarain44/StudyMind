import express from 'express';
import { z } from 'zod';
import { Quiz } from '../models/Quiz.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { Course } from '../models/Course.js';
import { requireAuth } from '../middleware/auth.js';
import {
  escapeRegExp,
  isObjectId,
  pagedResponse,
  parseBody,
  parsePagination,
  requireDb,
  resolveCourseId,
} from './common.js';

const router = express.Router();

router.use(requireAuth, requireDb);

export const questionSchema = z
  .object({
    question: z.string().trim().min(1, 'Question text is required.').max(500),
    options: z
      .array(z.string().trim().min(1, 'An option cannot be empty.').max(200))
      .min(2, 'Each question needs at least 2 options.')
      .max(6, 'Each question can have at most 6 options.'),
    correctIndex: z.number().int().min(0, 'correctIndex must be 0 or more.'),
    explanation: z.string().trim().max(1000).optional(),
  })
  .refine((q) => q.correctIndex < q.options.length, {
    message: 'correctIndex must point at one of the options.',
  });

export const quizSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120),
  description: z.string().trim().max(500).optional(),
  courseId: z.string().optional().nullable(),
  timeLimitSeconds: z.number().int().min(10).max(14400).optional().nullable(),
  questions: z
    .array(questionSchema)
    .min(1, 'A quiz needs at least 1 question.')
    .max(100, 'A quiz can have at most 100 questions.'),
  archived: z.boolean().optional(),
});

const quizUpdateSchema = quizSchema.partial();

const attemptSchema = z.object({
  answers: z.array(z.number().int()).min(1, 'Answers are required.'),
  timeTakenSeconds: z.number().int().min(0).optional().nullable(),
});

/** Grade an attempt server-side. Never trust a score from the client. */
function grade(quiz, answers) {
  let score = 0;
  const results = quiz.questions.map((q, i) => {
    const selected = answers[i];
    const correct = selected === q.correctIndex;
    if (correct) score += 1;
    return {
      questionIndex: i,
      question: q.question,
      selected,
      correctIndex: q.correctIndex,
      correct,
      explanation: q.explanation || '',
    };
  });
  return { score, total: quiz.questions.length, results };
}

// GET /api/v1/quizzes — list own quizzes (?courseId, ?search, ?archived, pagination).
// The list omits the questions array (with a questionCount instead) to keep
// it light; GET /:id returns the full quiz for taking/editing.
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter = { userId: req.user._id };
    if (req.query.courseId) {
      if (!isObjectId(req.query.courseId)) {
        return res.status(400).json({ error: 'courseId is not a valid course.' });
      }
      filter.courseId = req.query.courseId;
    }
    if (req.query.archived !== undefined) {
      filter.archived = req.query.archived === 'true';
    }
    if (req.query.search) {
      filter.title = { $regex: escapeRegExp(String(req.query.search)), $options: 'i' };
    }
    const [quizzes, total] = await Promise.all([
      Quiz.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Quiz.countDocuments(filter),
    ]);
    const items = quizzes.map((q) => ({
      ...q,
      questionCount: q.questions.length,
      questions: undefined,
    }));
    return res.json(pagedResponse(items, 'quizzes', total, { page, limit }));
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/quizzes
router.post('/', async (req, res, next) => {
  try {
    const data = parseBody(quizSchema, req, res);
    if (!data) return;
    const courseId = await resolveCourseId(data.courseId, req.user._id, res);
    if (courseId === undefined) return;
    const quiz = await Quiz.create({ ...data, courseId, userId: req.user._id });
    return res.status(201).json({ quiz });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/quizzes/stats — real aggregates from the user's own attempts.
// ?courseId narrows to one course. Per-course breakdown is included so the
// client can show per-subject stats without inventing numbers.
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const courseFilter = {};
    if (req.query.courseId) {
      if (!isObjectId(req.query.courseId)) {
        return res.status(400).json({ error: 'courseId is not a valid course.' });
      }
      courseFilter.courseId = req.query.courseId;
    }
    const [quizzes, attempts, courses] = await Promise.all([
      Quiz.find({ userId, ...courseFilter }).lean(),
      QuizAttempt.find({ userId }).populate('quizId', 'courseId title').lean(),
      Course.find({ userId }).lean(),
    ]);
    const courseTitles = new Map(courses.map((c) => [String(c._id), c.title]));
    const mine = attempts.filter(
      (a) => a.quizId && (!courseFilter.courseId || String(a.quizId.courseId) === String(courseFilter.courseId)),
    );
    const avg = (list) =>
      list.length === 0 ? null : Math.round(list.reduce((s, a) => s + a.percentage, 0) / list.length);
    const byCourseMap = new Map();
    for (const a of mine) {
      const cid = String(a.quizId.courseId || 'none');
      const entry = byCourseMap.get(cid) || {
        courseId: a.quizId.courseId || null,
        courseTitle: a.quizId.courseId ? courseTitles.get(cid) || 'Unknown course' : 'No course',
        quizzes: new Set(),
        attempts: 0,
        totalPercentage: 0,
      };
      entry.quizzes.add(String(a.quizId._id));
      entry.attempts += 1;
      entry.totalPercentage += a.percentage;
      byCourseMap.set(cid, entry);
    }
    const byCourse = [...byCourseMap.values()].map((e) => ({
      courseId: e.courseId,
      courseTitle: e.courseTitle,
      quizzes: e.quizzes.size,
      attempts: e.attempts,
      averagePercentage: e.attempts === 0 ? null : Math.round(e.totalPercentage / e.attempts),
    }));
    return res.json({
      totalQuizzes: quizzes.length,
      totalAttempts: mine.length,
      averagePercentage: avg(mine),
      bestPercentage: mine.length === 0 ? null : Math.max(...mine.map((a) => a.percentage)),
      byCourse,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/quizzes/:id — 404 when it belongs to another user (no leak).
router.get('/:id', async (req, res, next) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, userId: req.user._id });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    return res.json({ quiz });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/v1/quizzes/:id
router.put('/:id', async (req, res, next) => {
  try {
    const data = parseBody(quizUpdateSchema, req, res);
    if (!data) return;
    if (data.courseId !== undefined) {
      const courseId = await resolveCourseId(data.courseId, req.user._id, res);
      if (courseId === undefined) return;
      data.courseId = courseId;
    }
    const quiz = await Quiz.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      data,
      { new: true, runValidators: true },
    );
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    return res.json({ quiz });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/v1/quizzes/:id — also deletes its attempts.
router.delete('/:id', async (req, res, next) => {
  try {
    const quiz = await Quiz.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    await QuizAttempt.deleteMany({ quizId: quiz._id, userId: req.user._id });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/quizzes/:id/attempts — submit answers, auto-grade server-side.
// The response includes the score and, for each question, the correct answer
// and explanation — only AFTER submit, never before.
router.post('/:id/attempts', async (req, res, next) => {
  try {
    const data = parseBody(attemptSchema, req, res);
    if (!data) return;
    const quiz = await Quiz.findOne({ _id: req.params.id, userId: req.user._id });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    if (data.answers.length !== quiz.questions.length) {
      return res
        .status(400)
        .json({ error: `This quiz has ${quiz.questions.length} questions; ${data.answers.length} answers were sent.` });
    }
    for (let i = 0; i < data.answers.length; i += 1) {
      const a = data.answers[i];
      if (a < 0 || a >= quiz.questions[i].options.length) {
        return res.status(400).json({ error: `Answer ${i + 1} is not a valid option.` });
      }
    }
    const { score, total, results } = grade(quiz, data.answers);
    const attempt = await QuizAttempt.create({
      userId: req.user._id,
      quizId: quiz._id,
      answers: data.answers,
      score,
      total,
      percentage: Math.round((score / total) * 100),
      timeTakenSeconds: data.timeTakenSeconds ?? null,
    });
    return res.status(201).json({ attempt, results });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/quizzes/:id/attempts — attempt history, newest first.
router.get('/:id/attempts', async (req, res, next) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, userId: req.user._id });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    const { page, limit, skip } = parsePagination(req);
    const filter = { userId: req.user._id, quizId: quiz._id };
    const [attempts, total] = await Promise.all([
      QuizAttempt.find(filter).sort({ completedAt: -1 }).skip(skip).limit(limit),
      QuizAttempt.countDocuments(filter),
    ]);
    return res.json(pagedResponse(attempts, 'attempts', total, { page, limit }));
  } catch (err) {
    return next(err);
  }
});

export default router;
