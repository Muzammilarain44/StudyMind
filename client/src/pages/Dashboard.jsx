import { useEffect, useState } from 'react';
import { fetchHealth } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not reach the API.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back{user ? `, ${user.name}` : ''}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Phase 2 — auth is live. Real metrics arrive once you have courses, tasks and sessions (Phases 3–5).
        </p>
      </div>

      <section
        aria-label="API health"
        className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="font-semibold">API health (live)</h2>
        {loading && <p className="mt-2 text-sm text-slate-500">Checking the API…</p>}
        {error && (
          <div className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
            <p className="font-medium">Could not reach the API.</p>
            <p className="mt-1">
              Start the backend first (<code>cd server &amp;&amp; npm run dev</code>) and refresh. Error: {error}
              On the free Render tier the first request after idle can take about a minute while the service wakes up.
            </p>
          </div>
        )}
        {health && (
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">HTTP status</dt>
              <dd className="font-semibold">{health.httpStatus}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">API status</dt>
              <dd className="font-semibold">{health.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Database</dt>
              <dd className="font-semibold">{health.db}</dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="text-slate-500 dark:text-slate-400">Checked at</dt>
              <dd className="font-mono text-xs">{health.timestamp}</dd>
            </div>
          </dl>
        )}
      </section>

      <section
        aria-label="Your study data"
        className="rounded-xl border border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 className="font-semibold">Nothing here yet — and that is honest</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          No courses, tasks, notes or study sessions exist yet, so there are no metrics to show.
          This dashboard will only ever show numbers calculated from your own stored data — no demo
          counters and no fake charts.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
          <li>Courses &amp; notes — Phase 3</li>
          <li>Quizzes, flashcards &amp; Pomodoro — Phase 4</li>
          <li>GPA &amp; analytics — Phase 5</li>
        </ul>
      </section>
    </div>
  );
}
