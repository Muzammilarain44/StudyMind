import { useCallback, useEffect, useState } from 'react';
import { coursesApi, gpaApi, settingsApi } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { btnDanger, btnGhost, btnPrimary, cardCls, inputCls, labelCls, selectCls } from '../lib/ui-classes.js';

const GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F'];

const emptyForm = { title: '', semester: '', grade: 'A', courseId: '', creditHours: '' };

export default function Gpa() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [compute, setCompute] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scale, setScale] = useState(null);
  const [scaleBusy, setScaleBusy] = useState(false);
  const [scaleMessage, setScaleMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, result, courseList] = await Promise.all([
        gpaApi.list({ limit: 100 }),
        gpaApi.compute(),
        coursesApi.list({ limit: 100 }),
      ]);
      setRecords(list.records || []);
      setCompute(result);
      setCourses(courseList.courses || []);
      setScale(result.scale || null);
    } catch (err) {
      setError(err.message || 'Could not load GPA records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleCourseChange(courseId) {
    const course = courses.find((c) => String(c._id) === String(courseId));
    setForm((f) => ({
      ...f,
      courseId,
      title: course ? course.title : f.title,
      creditHours:
        course && course.creditHours !== undefined && course.creditHours !== null
          ? String(course.creditHours)
          : f.creditHours,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    const body = {
      title: form.title.trim(),
      semester: form.semester.trim(),
      grade: form.grade,
      courseId: form.courseId || null,
      creditHours: form.creditHours === '' ? undefined : Number(form.creditHours),
    };
    if (!body.title) {
      setError('Title is required.');
      return;
    }
    if (body.creditHours !== undefined && (Number.isNaN(body.creditHours) || body.creditHours < 0 || body.creditHours > 12)) {
      setError('Credit hours must be between 0 and 12.');
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await gpaApi.update(editingId, body);
        setMessage('Record updated.');
      } else {
        await gpaApi.create(body);
        setMessage('Record added.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not save the record.');
    } finally {
      setBusy(false);
    }
  }

  function handleEdit(record) {
    setEditingId(record._id);
    setForm({
      title: record.title,
      semester: record.semester || '',
      grade: record.grade,
      courseId: record.courseId ? String(record.courseId) : '',
      creditHours: String(record.creditHours),
    });
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this GPA record?')) return;
    setError('');
    try {
      await gpaApi.remove(id);
      setMessage('Record deleted.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete the record.');
    }
  }

  async function handleScaleSave(e) {
    e.preventDefault();
    setScaleMessage('');
    setScaleBusy(true);
    try {
      const result = await settingsApi.update({ gradingScale: scale });
      setScale(result.user.gradingScale);
      setScaleMessage('Grading scale saved. Your GPA was re-computed with the new scale.');
      await load();
    } catch (err) {
      setScaleMessage(err.message || 'Could not save the scale.');
    } finally {
      setScaleBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">GPA Calculator</h1>
        <p className="text-sm text-slate-500">Loading your GPA records…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GPA Calculator</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Credit-weighted GPA from your saved grades. Results are <strong>estimates</strong> —
          universities use different grading scales and policies.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300" role="status">
          {message}
        </div>
      )}

      {/* Computed GPA */}
      <section className={cardCls} aria-label="Computed GPA">
        {compute && compute.gpa !== null ? (
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Your GPA (estimate)</p>
              <p className="text-4xl font-bold">{compute.gpa.toFixed(2)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {compute.totalCredits} credit hours · {compute.recordCount} records ·{' '}
                {user?.gradingScale ? 'your custom scale' : '4.0 scale'}
              </p>
            </div>
            {compute.bySemester.length > 0 && (
              <dl className="flex flex-wrap gap-4 text-sm">
                {compute.bySemester.map((s) => (
                  <div key={s.semester}>
                    <dt className="text-slate-500 dark:text-slate-400">{s.semester}</dt>
                    <dd className="font-semibold">{s.gpa !== null ? s.gpa.toFixed(2) : '—'}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No GPA records yet. Add a grade below and your GPA will appear here.
          </p>
        )}
      </section>

      {/* Add / edit record */}
      <section className={cardCls}>
        <h2 className="font-semibold">{editingId ? 'Edit GPA record' : 'Add a grade'}</h2>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="gpa-title" className={labelCls}>Title</label>
              <input
                id="gpa-title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputCls}
                placeholder="e.g. Mathematics"
              />
            </div>
            <div>
              <label htmlFor="gpa-semester" className={labelCls}>Semester</label>
              <input
                id="gpa-semester"
                value={form.semester}
                onChange={(e) => setForm({ ...form, semester: e.target.value })}
                className={inputCls}
                placeholder="e.g. Fall 2026"
              />
            </div>
            <div>
              <label htmlFor="gpa-course" className={labelCls}>Link a course (optional)</label>
              <select
                id="gpa-course"
                value={form.courseId}
                onChange={(e) => handleCourseChange(e.target.value)}
                className={selectCls}
              >
                <option value="">No course</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title}
                    {c.creditHours !== undefined && c.creditHours !== null ? ` (${c.creditHours} cr)` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="gpa-grade" className={labelCls}>Grade</label>
                <select
                  id="gpa-grade"
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                  className={selectCls}
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="gpa-credits" className={labelCls}>Credit hours</label>
                <input
                  id="gpa-credits"
                  type="number"
                  min="0"
                  max="12"
                  step="0.5"
                  value={form.creditHours}
                  onChange={(e) => setForm({ ...form, creditHours: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. 3"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Picking a course fills in its credit hours automatically. Credit hours are required —
            either type them or link a course that has them.
          </p>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? 'Saving…' : editingId ? 'Update record' : 'Add record'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className={btnGhost}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Records list */}
      <section className={cardCls}>
        <h2 className="font-semibold">Saved grades ({records.length})</h2>
        {records.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            No grades saved yet. Your GPA will be calculated from the records you add here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {records.map((r) => (
              <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {r.semester || 'No semester'} · {r.creditHours} credit hours
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700 dark:bg-slate-800 dark:text-white">
                    {r.grade}
                  </span>
                  <button type="button" onClick={() => handleEdit(r)} className={btnGhost}>
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(r._id)} className={btnDanger}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Grading scale */}
      <section className={cardCls}>
        <h2 className="font-semibold">Your grading scale</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Grade points for each letter. The default is the 4.0 scale. Change a value only if your
          university uses a different scale.
        </p>
        {scale && (
          <form className="mt-4" onSubmit={handleScaleSave}>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {GRADES.map((g) => (
                <div key={g}>
                  <label htmlFor={`scale-${g}`} className={labelCls}>{g}</label>
                  <input
                    id={`scale-${g}`}
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={scale[g] ?? ''}
                    onChange={(e) =>
                      setScale({ ...scale, [g]: e.target.value === '' ? 0 : Number(e.target.value) })
                    }
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
            <button type="submit" disabled={scaleBusy} className={`${btnPrimary} mt-4`}>
              {scaleBusy ? 'Saving…' : 'Save scale'}
            </button>
            {scaleMessage && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400" role="status">
                {scaleMessage}
              </p>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
