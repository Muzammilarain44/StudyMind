import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Course } from '../models/Course.js';
import { Note } from '../models/Note.js';
import { Task } from '../models/Task.js';
import { Quiz } from '../models/Quiz.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { FlashcardDeck } from '../models/FlashcardDeck.js';
import { Flashcard } from '../models/Flashcard.js';
import { FlashcardReview } from '../models/FlashcardReview.js';
import { StudySession } from '../models/StudySession.js';
import { GpaRecord } from '../models/GpaRecord.js';
import { clearAuthCookie, publicUser } from '../auth.js';
import { requireAuth } from '../middleware/auth.js';
import { GRADE_LETTERS } from '../gpa.js';
import { parseBody, requireDb } from './common.js';

const router = express.Router();

router.use(requireAuth, requireDb);

const scaleSchema = z
  .object(
    Object.fromEntries(
      GRADE_LETTERS.map((letter) => [
        letter,
        z.number().min(0, 'Grade points cannot be negative.').max(5).optional(),
      ]),
    ),
  )
  .partial();

const settingsSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  timezone: z.string().trim().min(1, 'Timezone is required.').max(100).optional(),
  gradingScale: scaleSchema.optional(),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required to delete your account.').max(128),
});

// PATCH /api/v1/settings — theme, timezone and grading scale. Partial update:
// only the fields sent are changed. The grading scale is validated (letters
// A–F only, points 0–5) and merged with the existing scale.
router.patch('/', async (req, res, next) => {
  try {
    const data = parseBody(settingsSchema, req, res);
    if (!data) return;
    if (data.timezone) {
      // Validate against the platform's IANA timezone list when available.
      try {
        const supported = Intl.supportedValuesOf('timeZone');
        if (supported.length > 0 && !supported.includes(data.timezone)) {
          return res.status(400).json({ error: 'Timezone is not a recognised IANA timezone.' });
        }
      } catch {
        // Intl list unavailable — accept any non-empty string (already validated).
      }
    }
    if (data.theme !== undefined) req.user.theme = data.theme;
    if (data.timezone !== undefined) req.user.timezone = data.timezone;
    if (data.gradingScale !== undefined) {
      const current = req.user.gradingScale ? req.user.gradingScale.toObject() : {};
      req.user.gradingScale = { ...current, ...data.gradingScale };
    }
    await req.user.save();
    return res.json({ user: publicUser(req.user) });
  } catch (err) {
    return next(err);
  }
});

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvSection(title, columns, rows) {
  const lines = [`## ${title}`, columns.join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(','));
  return lines.join('\n');
}

// GET /api/v1/settings/export?format=json|csv — download ALL of the user's
// own data. Only the requesting user's documents are ever included.
router.get('/export', async (req, res, next) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const userId = req.user._id;
    const [courses, notes, tasks, quizzes, quizAttempts, decks, cards, reviews, sessions, gpaRecords] =
      await Promise.all([
        Course.find({ userId }).lean(),
        Note.find({ userId }).lean(),
        Task.find({ userId }).lean(),
        Quiz.find({ userId }).lean(),
        QuizAttempt.find({ userId }).lean(),
        FlashcardDeck.find({ userId }).lean(),
        Flashcard.find({ userId }).lean(),
        FlashcardReview.find({ userId }).lean(),
        StudySession.find({ userId }).lean(),
        GpaRecord.find({ userId }).lean(),
      ]);
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      const sections = [
        csvSection('Courses', ['title', 'code', 'semester', 'creditHours', 'archived', 'createdAt'], courses),
        csvSection('Notes', ['title', 'courseId', 'tags', 'pinned', 'archived', 'updatedAt'], notes),
        csvSection('Tasks', ['title', 'priority', 'dueDate', 'completed', 'completedAt'], tasks),
        csvSection('Quizzes', ['title', 'courseId', 'archived', 'createdAt'], quizzes),
        csvSection(
          'QuizAttempts',
          ['quizId', 'score', 'total', 'percentage', 'completedAt'],
          quizAttempts,
        ),
        csvSection('FlashcardDecks', ['title', 'courseId', 'createdAt'], decks),
        csvSection('Flashcards', ['deckId', 'front', 'back', 'createdAt'], cards),
        csvSection('FlashcardReviews', ['cardId', 'rating', 'intervalDays', 'nextDue', 'reviewedAt'], reviews),
        csvSection(
          'StudySessions',
          ['type', 'plannedMinutes', 'actualMinutes', 'status', 'startedAt', 'completedAt'],
          sessions,
        ),
        csvSection('GpaRecords', ['title', 'semester', 'grade', 'creditHours', 'createdAt'], gpaRecords),
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="studymind-export-${date}.csv"`);
      return res.send(sections.join('\n\n'));
    }
    res.setHeader('Content-Disposition', `attachment; filename="studymind-export-${date}.json"`);
    return res.json({
      exportedAt: new Date().toISOString(),
      user: publicUser(req.user),
      courses,
      notes,
      tasks,
      quizzes,
      quizAttempts,
      flashcardDecks: decks,
      flashcards: cards,
      flashcardReviews: reviews,
      studySessions: sessions,
      gpaRecords,
    });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/v1/settings/account — delete the account AND all of the user's
// own data, after password confirmation. Platform content the admin created
// (curated subjects and sample quizzes) is NOT deleted — other users rely on
// it. The auth cookie is cleared; the old token stops working because the
// user no longer exists.
router.delete('/account', async (req, res, next) => {
  try {
    const data = parseBody(deleteAccountSchema, req, res);
    if (!data) return;
    const ok = await bcrypt.compare(data.password, req.user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Password is incorrect.' });
    }
    const userId = req.user._id;
    await Promise.all([
      Course.deleteMany({ userId }),
      Note.deleteMany({ userId }),
      Task.deleteMany({ userId }),
      Quiz.deleteMany({ userId, isSample: { $ne: true } }),
      QuizAttempt.deleteMany({ userId }),
      FlashcardDeck.deleteMany({ userId }),
      Flashcard.deleteMany({ userId }),
      FlashcardReview.deleteMany({ userId }),
      StudySession.deleteMany({ userId }),
      GpaRecord.deleteMany({ userId }),
      User.deleteOne({ _id: userId }),
    ]);
    clearAuthCookie(res);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
