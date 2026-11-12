import express from 'express';
import { Course } from '../models/Course.js';
import { Task } from '../models/Task.js';
import { Quiz } from '../models/Quiz.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { StudySession } from '../models/StudySession.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDb } from './common.js';

const router = express.Router();

router.use(requireAuth, requireDb);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKey(d) {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}

// GET /api/v1/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
// Real numbers only, computed from the user's own stored data: completed
// focus sessions, completed tasks and quiz attempts. No demo data is ever
// returned — an empty range returns zeros and empty series, and the client
// shows an honest empty state. Default range: last 30 days ending today.
// Max range: 366 days.
router.get('/overview', async (req, res, next) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const defaultFrom = new Date(today);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);

    const from = req.query.from ? parseDay(req.query.from) : defaultFrom;
    const to = req.query.to ? parseDay(req.query.to) : today;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to must be dates like 2026-11-01.' });
    }
    if (from > to) {
      return res.status(400).json({ error: 'from must not be after to.' });
    }
    const rangeDays = Math.round((to - from) / 86400000) + 1;
    if (rangeDays > 366) {
      return res.status(400).json({ error: 'Date range must be at most 366 days.' });
    }

    const fromStart = new Date(from);
    const toEnd = new Date(to);
    toEnd.setUTCHours(23, 59, 59, 999);
    const userId = req.user._id;

    const [courses, tasks, quizzes, attempts, sessions] = await Promise.all([
      Course.find({ userId }).lean(),
      Task.find({ userId, completed: true, completedAt: { $gte: fromStart, $lte: toEnd } }).lean(),
      Quiz.find({ userId }).lean(),
      QuizAttempt.find({ userId, completedAt: { $gte: fromStart, $lte: toEnd } }).lean(),
      StudySession.find({
        userId,
        type: 'focus',
        status: 'completed',
        completedAt: { $gte: fromStart, $lte: toEnd },
      }).lean(),
    ]);

    // Daily series — one entry per day in the range, even with no activity.
    const daily = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      daily.push({
        date: dayKey(cursor),
        focusMinutes: 0,
        tasksCompleted: 0,
        quizAttempts: 0,
        quizTotalPercentage: 0,
        averageQuizPercentage: null,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const byDay = new Map(daily.map((d) => [d.date, d]));
    for (const s of sessions) {
      const entry = byDay.get(dayKey(s.completedAt));
      if (entry) entry.focusMinutes += s.actualMinutes ?? 0;
    }
    for (const t of tasks) {
      const entry = byDay.get(dayKey(t.completedAt));
      if (entry) entry.tasksCompleted += 1;
    }
    for (const a of attempts) {
      const entry = byDay.get(dayKey(a.completedAt));
      if (entry) {
        entry.quizAttempts += 1;
        entry.quizTotalPercentage += a.percentage;
      }
    }
    for (const d of daily) {
      if (d.quizAttempts > 0) {
        d.averageQuizPercentage = Math.round(d.quizTotalPercentage / d.quizAttempts);
      }
      delete d.quizTotalPercentage;
    }

    const totalFocusMinutes = sessions.reduce((s, x) => s + (x.actualMinutes ?? 0), 0);
    const averageQuizPercentage =
      attempts.length === 0
        ? null
        : Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length);

    // Per-course breakdown (tasks + quizzes carry a courseId; focus sessions
    // do not, so they are reported in the totals and daily series only).
    const courseTitles = new Map(courses.map((c) => [String(c._id), c.title]));
    const quizCourse = new Map(quizzes.map((q) => [String(q._id), q.courseId ? String(q.courseId) : null]));
    const byCourseMap = new Map();
    const ensureCourse = (courseId) => {
      const key = courseId ? String(courseId) : 'none';
      if (!byCourseMap.has(key)) {
        byCourseMap.set(key, {
          courseId: courseId || null,
          courseTitle: courseId ? courseTitles.get(String(courseId)) || 'Unknown course' : 'No course',
          tasksCompleted: 0,
          quizzes: new Set(),
          quizAttempts: 0,
          quizTotalPercentage: 0,
        });
      }
      return byCourseMap.get(key);
    };
    for (const t of tasks) ensureCourse(t.courseId).tasksCompleted += 1;
    for (const a of attempts) {
      const entry = ensureCourse(quizCourse.get(String(a.quizId)));
      entry.quizAttempts += 1;
      entry.quizTotalPercentage += a.percentage;
      entry.quizzes.add(String(a.quizId));
    }
    const byCourse = [...byCourseMap.values()].map((e) => ({
      courseId: e.courseId,
      courseTitle: e.courseTitle,
      tasksCompleted: e.tasksCompleted,
      quizzes: e.quizzes.size,
      quizAttempts: e.quizAttempts,
      averageQuizPercentage:
        e.quizAttempts === 0 ? null : Math.round(e.quizTotalPercentage / e.quizAttempts),
    }));

    return res.json({
      from: dayKey(from),
      to: dayKey(to),
      totals: {
        totalFocusMinutes,
        completedFocusSessions: sessions.length,
        tasksCompleted: tasks.length,
        totalQuizAttempts: attempts.length,
        averageQuizPercentage,
        bestQuizPercentage:
          attempts.length === 0 ? null : Math.max(...attempts.map((a) => a.percentage)),
      },
      daily,
      byCourse,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
