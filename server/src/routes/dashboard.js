import express from 'express';
import { Course } from '../models/Course.js';
import { Note } from '../models/Note.js';
import { Task } from '../models/Task.js';
import { requireAuth } from '../middleware/auth.js';
import { requireDb } from './common.js';

const router = express.Router();

router.use(requireAuth, requireDb);

// GET /api/v1/dashboard — real metrics calculated from the user's own DB
// data only. No study-time / quiz numbers yet (Phases 4–5) — they are not
// invented here; the response simply does not include them.
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

    const [courses, tasks, recentNotes] = await Promise.all([
      Course.find({ userId }).sort({ archived: 1, title: 1 }).lean(),
      Task.find({ userId }).sort({ dueDate: 1, createdAt: -1 }).lean(),
      Note.find({ userId, archived: false }).sort({ updatedAt: -1 }).limit(5).lean(),
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

    return res.json({
      totalCourses: courses.length,
      activeCourses: activeCourses.length,
      totalTasks: tasks.length,
      completedTasks,
      overdueTasks,
      dueTodayTasks,
      dueNext7Days,
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
