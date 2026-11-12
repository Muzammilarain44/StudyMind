import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, fetchHealth } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { cardCls } from '../lib/ui-classes.js';

function Stat({ label, value, to }) {
  const inner = (
    <>
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-2xl font-bold">{value}</dd>
    </>
  );
  return (
    <div className={cardCls}>
      {to ? (
        <Link to={to} className="block">
          <dl>{inner}</dl>
        </Link>
      ) : (
        <dl>{inner}</dl>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([dashboardApi.get(), fetchHealth().catch(() => null)])
      .then(([dashboard, healthData]) => {
        if (cancelled) return;
        setData(dashboard);
        setHealth(healthData);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the dashboard.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Welcome back{user ? `, ${user.name}` : ''}</h1>
        <p className="text-sm text-slate-500">Loading your dashboard…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Welcome back{user ? `, ${user.name}` : ''}</h1>
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          <p className="font-medium">Could not load the dashboard.</p>
          <p className="mt-1">Error: {error || 'No data returned.'} Try refreshing the page.</p>
        </div>
      </div>
    );
  }

  const hasAnything = data.totalCourses > 0 || data.totalTasks > 0 || (data.quizzesTaken ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back{user ? `, ${user.name}` : ''}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Every number below is calculated from your own courses, notes, tasks, quizzes and
          focus sessions — nothing is invented.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active courses" value={data.activeCourses} to="/courses" />
        <Stat label="Tasks done" value={`${data.completedTasks} / ${data.totalTasks}`} to="/planner" />
        <Stat label="Overdue tasks" value={data.overdueTasks} to="/planner" />
        <Stat label="Due today" value={data.dueTodayTasks} to="/planner" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Study streak" value={`${data.studyStreakDays ?? 0} day${(data.studyStreakDays ?? 0) === 1 ? '' : 's'}`} to="/pomodoro" />
        <Stat label="Focus today" value={`${data.focusMinutesToday ?? 0} min`} to="/pomodoro" />
        <Stat label="Quizzes taken" value={data.quizzesTaken ?? 0} to="/quizzes" />
        <Stat
          label="Average quiz score"
          value={data.averageQuizPercentage === null || data.averageQuizPercentage === undefined ? '—' : `${data.averageQuizPercentage}%`}
          to="/quizzes"
        />
      </div>

      {!hasAnything && (
        <div className={`${cardCls} border-dashed`}>
          <h2 className="font-semibold">Nothing here yet — and that is honest</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            No courses, tasks or notes exist yet, so there are no metrics to show. Start with a course, add a
            task with a due date, and this dashboard will fill in with real numbers.
          </p>
          <p className="mt-3 text-sm">
            <Link to="/courses" className="font-medium text-brand-600 dark:text-brand-100">Add your first course →</Link>
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cardCls} aria-label="Next tasks">
          <h2 className="font-semibold">Next tasks</h2>
          {data.nextTasks.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              No incomplete tasks. Add one from the <Link to="/planner" className="font-medium text-brand-600 dark:text-brand-100">Planner</Link>.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.nextTasks.map((t) => (
                <li key={t._id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{t.title}</span>
                  <span className="shrink-0 text-slate-500 dark:text-slate-400">
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No due date'} · {t.priority}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {data.dueNext7Days} task{data.dueNext7Days === 1 ? '' : 's'} due in the next 7 days.
          </p>
        </section>

        <section className={cardCls} aria-label="Recent notes">
          <h2 className="font-semibold">Recent notes</h2>
          {data.recentNotes.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              No notes yet. Write one from the <Link to="/notes" className="font-medium text-brand-600 dark:text-brand-100">Notes</Link> page.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.recentNotes.map((n) => (
                <li key={n._id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">
                    {n.pinned ? '📌 ' : ''}{n.title}
                  </span>
                  <span className="shrink-0 text-slate-500 dark:text-slate-400">
                    {n.courseTitle || 'No course'} · {new Date(n.updatedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data.tasksByCourse.length > 0 && (
        <section className={cardCls} aria-label="Subject progress">
          <h2 className="font-semibold">Subject progress</h2>
          <ul className="mt-3 space-y-3">
            {data.tasksByCourse.map((c) => {
              const pct = c.total === 0 ? 0 : Math.round((c.completed / c.total) * 100);
              return (
                <li key={c.courseId}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{c.title}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {c.completed} / {c.total} tasks · {pct}%
                    </span>
                  </div>
                  <div
                    className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progress for ${c.title}`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: c.colour || '#4F46E5' }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {health && (
        <section className={cardCls} aria-label="API health">
          <h2 className="font-semibold">API health (live)</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            HTTP {health.httpStatus} · {health.status} · Database {health.db}
            {health.timestamp ? ` · Checked at ${health.timestamp}` : ''}
          </p>
        </section>
      )}
    </div>
  );
}
