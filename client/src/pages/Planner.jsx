import { useCallback, useEffect, useMemo, useState } from 'react';
import { coursesApi, tasksApi } from '../lib/api.js';
import { btnDanger, btnGhost, btnPrimary, cardCls, inputCls, labelCls, selectCls } from '../lib/ui-classes.js';

const EMPTY_FORM = { title: '', description: '', courseId: '', dueDate: '', priority: 'medium' };

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toDateInput(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().slice(0, 10);
}

export default function Planner() {
  const [tasks, setTasks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | completed
  const [courseFilter, setCourseFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedDay, setSelectedDay] = useState(null); // 'YYYY-MM-DD' or null
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [taskData, courseData] = await Promise.all([
        tasksApi.list({ limit: 100 }),
        coursesApi.list({ limit: 100 }),
      ]);
      setTasks(taskData.tasks);
      setCourses(courseData.courses);
    } catch (err) {
      setError(err.message || 'Could not load tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const countsByDay = useMemo(() => {
    const counts = {};
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const key = dayKey(new Date(t.dueDate));
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  const calendarCells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
    return cells;
  }, [monthCursor]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter === 'active' && t.completed) return false;
      if (statusFilter === 'completed' && !t.completed) return false;
      if (courseFilter && String(t.courseId) !== courseFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (selectedDay) {
        if (!t.dueDate) return false;
        return dayKey(new Date(t.dueDate)) === selectedDay;
      }
      return true;
    });
  }, [tasks, statusFilter, courseFilter, priorityFilter, selectedDay]);

  const isOverdue = (task) =>
    !task.completed && task.dueDate && new Date(task.dueDate) < new Date();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        courseId: form.courseId || null,
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`).toISOString() : null,
        priority: form.priority,
      };
      if (editing) {
        await tasksApi.update(editing._id, body);
      } else {
        await tasksApi.create(body);
      }
      setForm(EMPTY_FORM);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not save the task.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(task) {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description || '',
      courseId: task.courseId || '',
      dueDate: toDateInput(task.dueDate),
      priority: task.priority || 'medium',
    });
    setError('');
  }

  async function toggleComplete(task) {
    try {
      await tasksApi.update(task._id, { completed: !task.completed });
      await load();
    } catch (err) {
      setError(err.message || 'Could not update the task.');
    }
  }

  async function handleDelete(task) {
    if (!window.confirm(`Delete the task "${task.title}"?`)) return;
    try {
      await tasksApi.remove(task._id);
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete the task.');
    }
  }

  const courseName = (id) => courses.find((c) => c._id === id)?.title || 'No course';
  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  function shiftMonth(delta) {
    setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Study Planner</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Tasks with due dates and priorities. Overdue tasks are highlighted in red. Reminders are in-app only — no push notifications in this version.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className={`${cardCls} space-y-4`} aria-label={editing ? 'Edit task' : 'New task'}>
        <h2 className="font-semibold">{editing ? 'Edit task' : 'New task'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="task-title" className={labelCls}>Title</label>
            <input
              id="task-title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
              placeholder="Read chapter 4"
            />
          </div>
          <div>
            <label htmlFor="task-course" className={labelCls}>Course (optional)</label>
            <select
              id="task-course"
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              className={selectCls}
            >
              <option value="">No course</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-due" className={labelCls}>Due date (optional)</label>
            <input
              id="task-due"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="task-priority" className={labelCls}>Priority</label>
            <select
              id="task-priority"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className={selectCls}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="task-desc" className={labelCls}>Description (optional)</label>
            <input
              id="task-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputCls}
              placeholder="What needs doing?"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add task'}
          </button>
          {editing && (
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setEditing(null);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Month calendar */}
      <section className={cardCls} aria-label="Calendar">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{monthLabel}</h2>
          <div className="flex gap-2">
            <button type="button" className={btnGhost} onClick={() => shiftMonth(-1)} aria-label="Previous month">
              ← Prev
            </button>
            <button
              type="button"
              className={btnGhost}
              onClick={() => setMonthCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            >
              Today
            </button>
            <button type="button" className={btnGhost} onClick={() => shiftMonth(1)} aria-label="Next month">
              Next →
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {calendarCells.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} />;
            const key = dayKey(date);
            const count = countsByDay[key] || 0;
            const isToday = key === dayKey(new Date());
            const selected = selectedDay === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(selected ? null : key)}
                aria-pressed={selected}
                aria-label={`${date.toDateString()}${count ? `, ${count} task${count > 1 ? 's' : ''} due` : ''}`}
                className={`rounded-lg border px-1 py-2 text-sm ${
                  selected
                    ? 'border-brand-500 bg-brand-50 dark:bg-slate-800'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                } ${isToday ? 'font-bold text-brand-600 dark:text-brand-100' : ''}`}
              >
                {date.getDate()}
                {count > 0 && <span className="block text-xs text-slate-500">{count} task{count > 1 ? 's' : ''}</span>}
              </button>
            );
          })}
        </div>
        {selectedDay && (
          <p className="mt-3 text-sm">
            Showing tasks due {selectedDay}.{' '}
            <button type="button" className="font-medium text-brand-600 dark:text-brand-100" onClick={() => setSelectedDay(null)}>
              Clear day filter
            </button>
          </p>
        )}
      </section>

      {/* Filters + list */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="task-status" className="sr-only">Filter by status</label>
        <select
          id="task-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="all">All tasks</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>
        <label htmlFor="task-course-filter" className="sr-only">Filter by course</label>
        <select
          id="task-course-filter"
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c._id} value={c._id}>{c.title}</option>
          ))}
        </select>
        <label htmlFor="task-priority-filter" className="sr-only">Filter by priority</label>
        <select
          id="task-priority-filter"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="">Any priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading tasks…</p>
      ) : visibleTasks.length === 0 ? (
        <div className={`${cardCls} border-dashed`}>
          <h2 className="font-semibold">No tasks here</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {tasks.length === 0
              ? 'Add your first task above — give it a due date and it will show up on the calendar.'
              : 'No tasks match the current filters.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visibleTasks.map((task) => (
            <li
              key={task._id}
              className={`${cardCls} flex flex-wrap items-center gap-3 ${isOverdue(task) ? 'border-red-300 dark:border-red-800' : ''}`}
            >
              <input
                type="checkbox"
                checked={!!task.completed}
                onChange={() => toggleComplete(task)}
                aria-label={`Mark "${task.title}" as ${task.completed ? 'not completed' : 'completed'}`}
                className="h-5 w-5"
              />
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${task.completed ? 'text-slate-400 line-through' : ''}`}>
                  {task.title}
                  {isOverdue(task) && <span className="ml-2 text-xs font-semibold text-red-600 dark:text-red-400">OVERDUE</span>}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {courseName(task.courseId)}
                  {task.dueDate ? ` · Due ${new Date(task.dueDate).toLocaleDateString()}` : ' · No due date'}
                  {` · ${task.priority} priority`}
                  {task.description ? ` · ${task.description}` : ''}
                </p>
              </div>
              <button type="button" className={btnGhost} onClick={() => startEdit(task)}>
                Edit
              </button>
              <button type="button" className={btnDanger} onClick={() => handleDelete(task)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
