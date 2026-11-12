import express from 'express';
import { Course } from '../models/Course.js';
import { Note } from '../models/Note.js';
import { Task } from '../models/Task.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { StudySession } from '../models/StudySession.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDb } from './common.js';

const router = express.Router();

router.use(requireAuth, requireDb);

// GET /api/v1/dashboard — real metrics calculated from the user's own DB
// data only. Phase 4 adds the study streak, focus minutes and quiz totals,
// all computed from stored tasks, completed Pomodoro sessions and quiz
// attempts — nothing is invented.
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const in7Days = new Date(startOfToday);
    in7Days.setDate(in7Days.getDate() + 7);

    const [courses, tasks, recentNotes, quizAttempts, focusSessions] = await Promise.all([
      Course.find({ userId }).sort({ archived: 1, title: 1 }).lean(),
      Task.find({ userId }).sort({ dueDate: 1, createdAt: -1 }).lean(),
      Note.find({ userId, archived: false }).sort({ updatedAt: -1 }).limit(5).lean(),
      QuizAttempt.find({ userId }).lean(),
      StudySession.find({ userId, type: 'focus', status: 'completed' }).lean(),
    ]);

    const activeCourses = courses.filter((c) => !c.archived);
    const incomplete = tasks.filter((t) => !t.completed);
    const completedTasks = tasks.length - incomplete.length;
    const overdueTasks = incomplete.filter((t) => t.dueDate && new Date(t.dueDate) < now).length;
    const dueTodayTasks = incomplete.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= startOfToday && d < startOfTomorrow;
    }).length;
    const dueNext7Days = incomplete.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= startOfToday && d < in7Days;
    }).length;

    // Next tasks: incomplete, dated first (earliest first), undated last.
    const nextTasks = [...incomplete]
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      })
      .slice(0, 5)
      .map((t) => ({
        _id: t._id,
        title: t.title,
        courseId: t.courseId,
        dueDate: t.dueDate,
        priority: t.priority,
      }));

    const courseTitles = new Map(courses.map((c) => [String(c._id), c.title]));
    const tasksByCourse = activeCourses.map((c) => {
      const mine = tasks.filter((t) => String(t.courseId) === String(c._id));
      return {
        courseId: c._id,
        title: c.title,
        colour: c.colour,
        total: mine.length,
        completed: mine.filter((t) => t.completed).length,
      };
    });

    // Study streak (Phase 0 definition): a day counts when the user
    // completed at least 1 task, OR 1 Pomodoro focus session, OR 1 quiz
    // attempt. Consecutive days back from today; if today has no activity
    // yet, the streak is counted from yesterday (it is still alive).
    const dayKey = (d) => {
      const x = new Date(d);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    };
    const activeDays = new Set();
    for (const t of tasks) {
      if (t.completed && t.completedAt) activeDays.add(dayKey(t.completedAt));
    }
    for (const s of focusSessions) {
      if (s.completedAt) activeDays.add(dayKey(s.completedAt));
    }
    for (const a of quizAttempts) {
      if (a.completedAt) activeDays.add(dayKey(a.completedAt));
    }
    let studyStreakDays = 0;
    const cursor = new Date(startOfToday);
    if (!activeDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (activeDays.has(dayKey(cursor))) {
      studyStreakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const focusMinutesToday = focusSessions
      .filter((s) => s.completedAt && new Date(s.completedAt) >= startOfToday)
      .reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0);
    const totalFocusMinutes = focusSessions.reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0);
    const averageQuizPercentage =
      quizAttempts.length === 0
        ? null
        : Math.round(quizAttempts.reduce((sum, a) => sum + a.percentage, 0) / quizAttempts.length);

    return res.json({
      totalCourses: courses.length,
      activeCourses: activeCourses.length,
      totalTasks: tasks.length,
      completedTasks,
      overdueTasks,
      dueTodayTasks,
      dueNext7Days,
      studyStreakDays,
      focusMinutesToday,
      totalFocusMinutes,
      quizzesTaken: quizAttempts.length,
      averageQuizPercentage,
      recentNotes: recentNotes.map((n) => ({
        _id: n._id,
        title: n.title,
        courseId: n.courseId,
        courseTitle: n.courseId ? courseTitles.get(String(n.courseId)) || null : null,
        updatedAt: n.updatedAt,
        pinned: n.pinned,
      })),
      nextTasks,
      tasksByCourse,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
