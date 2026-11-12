import express from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Course } from '../models/Course.js';
import { Note } from '../models/Note.js';
import { Task } from '../models/Task.js';
import { Quiz } from '../models/Quiz.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { FlashcardDeck } from '../models/FlashcardDeck.js';
import { Flashcard } from '../models/Flashcard.js';
import { StudySession } from '../models/StudySession.js';
import { GpaRecord } from '../models/GpaRecord.js';
import { CuratedSubject } from '../models/CuratedSubject.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { quizSchema } from './quizzes.js';
import {
  escapeRegExp,
  pagedResponse,
  parseBody,
  parsePagination,
  requireDb,
} from './common.js';

const router = express.Router();

router.use(requireAuth, requireDb);

const adminOnly = requireRole('admin');

const subjectSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120),
  code: z.string().trim().max(20).optional(),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(60).optional(),
});

const subjectUpdateSchema = subjectSchema.partial();

const sampleQuizUpdateSchema = quizSchema.partial();

/** Strip correct answers + explanations from a sample quiz for browsing. */
function publicSample(quiz) {
  const obj = quiz.toObject ? quiz.toObject() : quiz;
  return {
    ...obj,
    questionCount: obj.questions.length,
    questions: obj.questions.map((q) => ({
      question: q.question,
      options: q.options,
    })),
  };
}

// GET /api/v1/admin/stats — aggregate usage counts ONLY (admin). No private
// student content is ever returned here: counts, never notes or answers.
router.get('/stats', adminOnly, async (req, res, next) => {
  try {
    const [users, courses, notes, tasks, quizzes, quizAttempts, flashcardDecks, flashcards, studySessions, gpaRecords, curatedSubjects] =
      await Promise.all([
        User.countDocuments(),
        Course.countDocuments(),
        Note.countDocuments(),
        Task.countDocuments(),
        Quiz.countDocuments(),
        QuizAttempt.countDocuments(),
        FlashcardDeck.countDocuments(),
        Flashcard.countDocuments(),
        StudySession.countDocuments(),
        GpaRecord.countDocuments(),
        CuratedSubject.countDocuments(),
      ]);
    return res.json({
      users,
      courses,
      notes,
      tasks,
      quizzes,
      quizAttempts,
      flashcardDecks,
      flashcards,
      studySessions,
      gpaRecords,
      curatedSubjects,
    });
  } catch (err) {
    return next(err);
  }
});

// ---- Curated subjects ----
// GET is open to any logged-in user (students browse them); write is admin-only.
router.get('/subjects', async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter = {};
    if (req.query.search) {
      filter.title = { $regex: escapeRegExp(String(req.query.search)), $options: 'i' };
    }
    if (req.query.category) filter.category = String(req.query.category);
    const [subjects, total] = await Promise.all([
      CuratedSubject.find(filter).sort({ title: 1 }).skip(skip).limit(limit),
      CuratedSubject.countDocuments(filter),
    ]);
    return res.json(pagedResponse(subjects, 'subjects', total, { page, limit }));
  } catch (err) {
    return next(err);
  }
});

router.post('/subjects', adminOnly, async (req, res, next) => {
  try {
    const data = parseBody(subjectSchema, req, res);
    if (!data) return;
    const subject = await CuratedSubject.create({ ...data, createdBy: req.user._id });
    return res.status(201).json({ subject });
  } catch (err) {
    return next(err);
  }
});

router.get('/subjects/:id', async (req, res, next) => {
  try {
    const subject = await CuratedSubject.findById(req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found.' });
    return res.json({ subject });
  } catch (err) {
    return next(err);
  }
});

router.put('/subjects/:id', adminOnly, async (req, res, next) => {
  try {
    const data = parseBody(subjectUpdateSchema, req, res);
    if (!data) return;
    const subject = await CuratedSubject.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!subject) return res.status(404).json({ error: 'Subject not found.' });
    return res.json({ subject });
  } catch (err) {
    return next(err);
  }
});

router.delete('/subjects/:id', adminOnly, async (req, res, next) => {
  try {
    const subject = await CuratedSubject.findByIdAndDelete(req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found.' });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// ---- Sample quiz banks ----
// GET (browse) is open to any logged-in user; questions are returned WITHOUT
// correct answers. Write is admin-only. Copy is open to any logged-in user.
router.get('/sample-quizzes', async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter = { isSample: true };
    if (req.query.search) {
      filter.title = { $regex: escapeRegExp(String(req.query.search)), $options: 'i' };
    }
    const [quizzes, total] = await Promise.all([
      Quiz.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Quiz.countDocuments(filter),
    ]);
    const items = quizzes.map((q) => publicSample(q));
    return res.json(pagedResponse(items, 'quizzes', total, { page, limit }));
  } catch (err) {
    return next(err);
  }
});

router.post('/sample-quizzes', adminOnly, async (req, res, next) => {
  try {
    const data = parseBody(quizSchema, req, res);
    if (!data) return;
    const quiz = await Quiz.create({ ...data, courseId: null, userId: req.user._id, isSample: true });
    return res.status(201).json({ quiz });
  } catch (err) {
    return next(err);
  }
});

router.get('/sample-quizzes/:id', async (req, res, next) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, isSample: true });
    if (!quiz) return res.status(404).json({ error: 'Sample quiz not found.' });
    return res.json({ quiz: publicSample(quiz) });
  } catch (err) {
    return next(err);
  }
});

router.put('/sample-quizzes/:id', adminOnly, async (req, res, next) => {
  try {
    const data = parseBody(sampleQuizUpdateSchema, req, res);
    if (!data) return;
    const quiz = await Quiz.findOneAndUpdate(
      { _id: req.params.id, isSample: true },
      { ...data, courseId: null },
      { new: true, runValidators: true },
    );
    if (!quiz) return res.status(404).json({ error: 'Sample quiz not found.' });
    return res.json({ quiz });
  } catch (err) {
    return next(err);
  }
});

router.delete('/sample-quizzes/:id', adminOnly, async (req, res, next) => {
  try {
    const quiz = await Quiz.findOneAndDelete({ _id: req.params.id, isSample: true });
    if (!quiz) return res.status(404).json({ error: 'Sample quiz not found.' });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/admin/sample-quizzes/:id/copy — copy a sample into the
// student's own quizzes (read-only samples become theirs to take and edit).
router.post('/sample-quizzes/:id/copy', async (req, res, next) => {
  try {
    const sample = await Quiz.findOne({ _id: req.params.id, isSample: true });
    if (!sample) return res.status(404).json({ error: 'Sample quiz not found.' });
    const quiz = await Quiz.create({
      userId: req.user._id,
      title: sample.title,
      description: sample.description,
      courseId: null,
      timeLimitSeconds: sample.timeLimitSeconds,
      questions: sample.questions.map((q) => ({
        question: q.question,
        options: [...q.options],
        correctIndex: q.correctIndex,
        explanation: q.explanation || '',
      })),
      isSample: false,
    });
    return res.status(201).json({ quiz });
  } catch (err) {
    return next(err);
  }
});

export default router;
