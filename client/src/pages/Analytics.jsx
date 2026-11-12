import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { analyticsApi } from '../lib/api.js';
import { btnPrimary, cardCls, inputCls, labelCls } from '../lib/ui-classes.js';

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: isoDate(from), to: isoDate(to) };
}

export default function Analytics() {
  const [range, setRange] = useState(defaultRange);
  const [form, setForm] = useState(defaultRange);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (from, to) => {
    setLoading(true);
    setError('');
    try {
      const result = await analyticsApi.overview({ from, to });
      setData(result);
    } catch (err) {
      setError(err.message || 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range.from, range.to);
  }, [load, range]);

  function handleApply(e) {
    e.preventDefault();
    if (form.from > form.to) {
      setError('The start date must not be after the end date.');
      return;
    }
    setRange({ from: form.from, to: form.to });
  }

  const hasData =
    data &&
    (data.totals.totalFocusMinutes > 0 ||
      data.totals.tasksCompleted > 0 ||
      data.totals.totalQuizAttempts > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Real charts from your own study data — focus sessions, completed tasks and quiz
          results. Nothing here is demo data.
        </p>
      </div>

      {/* Date filter */}
      <form className={`${cardCls} flex flex-wrap items-end gap-4`} onSubmit={handleApply}>
        <div>
          <label htmlFor="analytics-from" className={labelCls}>From</label>
          <input
            id="analytics-from"
            type="date"
            required
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="analytics-to" className={labelCls}>To</label>
          <input
            id="analytics-to"
            type="date"
            required
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
            className={inputCls}
          />
        </div>
        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading analytics…</p>
      ) : !data ? (
        <p className="text-sm text-slate-500">No analytics data returned.</p>
      ) : !hasData ? (
        <section className={cardCls}>
          <h2 className="font-semibold">No study data in this range yet</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Complete a Pomodoro focus session, finish a task, or take a quiz between {data.from}{' '}
            and {data.to} and the charts will appear here. Try a wider date range, or check the
            Dashboard for your overall totals.
          </p>
        </section>
      ) : (
        <>
          {/* Totals */}
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" aria-label="Totals">
            {[
              { label: 'Focus minutes', value: data.totals.totalFocusMinutes },
              { label: 'Focus sessions', value: data.totals.completedFocusSessions },
              { label: 'Tasks completed', value: data.totals.tasksCompleted },
              { label: 'Quiz attempts', value: data.totals.totalQuizAttempts },
              {
                label: 'Avg quiz score',
                value: data.totals.averageQuizPercentage === null ? '—' : `${data.totals.averageQuizPercentage}%`,
              },
            ].map((stat) => (
              <div key={stat.label} className={cardCls}>
                <dt className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</dt>
                <dd className="text-2xl font-bold">{stat.value}</dd>
              </div>
            ))}
          </section>

          {/* Focus minutes per day */}
          <section className={cardCls}>
            <h2 className="font-semibold">Focus minutes per day</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="focusMinutes" name="Focus minutes" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Tasks completed + quiz attempts per day */}
          <section className={cardCls}>
            <h2 className="font-semibold">Tasks completed and quiz attempts per day</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.daily} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tasksCompleted" name="Tasks completed" fill="#16a34a" />
                  <Bar dataKey="quizAttempts" name="Quiz attempts" fill="#9333ea" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Quiz average per day */}
          <section className={cardCls}>
            <h2 className="font-semibold">Average quiz score per day (%)</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Days with no quiz attempts are not plotted.
            </p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="averageQuizPercentage"
                    name="Avg score %"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    connectNulls={false}
                    dot
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Per-course breakdown */}
          <section className={cardCls}>
            <h2 className="font-semibold">Breakdown by course</h2>
            {data.byCourse.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                No course activity in this range.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2 pr-2 font-medium">Course</th>
                      <th className="py-2 pr-2 font-medium">Tasks done</th>
                      <th className="py-2 pr-2 font-medium">Quizzes</th>
                      <th className="py-2 pr-2 font-medium">Attempts</th>
                      <th className="py-2 font-medium">Avg score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCourse.map((row) => (
                      <tr key={row.courseId || 'none'} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-2 font-medium">{row.courseTitle}</td>
                        <td className="py-2 pr-2">{row.tasksCompleted}</td>
                        <td className="py-2 pr-2">{row.quizzes}</td>
                        <td className="py-2 pr-2">{row.quizAttempts}</td>
                        <td className="py-2">{row.averageQuizPercentage === null ? '—' : `${row.averageQuizPercentage}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
