import { useCallback, useEffect, useState } from 'react';
import { coursesApi } from '../lib/api.js';
import { btnDanger, btnGhost, btnPrimary, cardCls, inputCls, labelCls } from '../lib/ui-classes.js';

const EMPTY_FORM = { title: '', code: '', semester: '', colour: '#4F46E5', creditHours: '' };

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await coursesApi.list({
        search: search.trim() || undefined,
        semester: semesterFilter || undefined,
        archived: showArchived ? true : false,
        limit: 100,
      });
      setCourses(data.courses);
    } catch (err) {
      setError(err.message || 'Could not load courses.');
    } finally {
      setLoading(false);
    }
  }, [search, semesterFilter, showArchived]);

  useEffect(() => {
    load();
  }, [load]);

  const semesters = [...new Set(courses.map((c) => c.semester))].sort();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.semester.trim()) {
      setError('Title and semester are required.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        code: form.code.trim(),
        semester: form.semester.trim(),
        colour: form.colour,
        creditHours: form.creditHours === '' ? undefined : Number(form.creditHours),
      };
      if (editing) {
        await coursesApi.update(editing._id, body);
      } else {
        await coursesApi.create(body);
      }
      setForm(EMPTY_FORM);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not save the course.');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(course) {
    setEditing(course);
    setForm({
      title: course.title,
      code: course.code || '',
      semester: course.semester,
      colour: course.colour || '#4F46E5',
      creditHours: course.creditHours ?? '',
    });
    setError('');
  }

  async function toggleArchive(course) {
    try {
      await coursesApi.update(course._id, { archived: !course.archived });
      await load();
    } catch (err) {
      setError(err.message || 'Could not update the course.');
    }
  }

  async function handleDelete(course) {
    if (!window.confirm(`Delete the course "${course.title}"? Its notes and tasks keep their course link cleared only if you remove them first — deleting a course does not delete your notes or tasks.`)) {
      return;
    }
    setDeletingId(course._id);
    try {
      await coursesApi.remove(course._id);
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete the course.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Courses</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Organise your subjects by semester. Archived courses stay out of the way but are not deleted.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className={`${cardCls} space-y-4`} aria-label={editing ? 'Edit course' : 'New course'}>
        <h2 className="font-semibold">{editing ? 'Edit course' : 'New course'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="course-title" className={labelCls}>Title</label>
            <input
              id="course-title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
              placeholder="Database Systems"
            />
          </div>
          <div>
            <label htmlFor="course-code" className={labelCls}>Code (optional)</label>
            <input
              id="course-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className={inputCls}
              placeholder="CS301"
            />
          </div>
          <div>
            <label htmlFor="course-semester" className={labelCls}>Semester</label>
            <input
              id="course-semester"
              required
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
              className={inputCls}
              placeholder="Fall 2026"
              list="course-semesters"
            />
            <datalist id="course-semesters">
              {semesters.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="course-credits" className={labelCls}>Credit hours (optional)</label>
            <input
              id="course-credits"
              type="number"
              min="0"
              max="12"
              value={form.creditHours}
              onChange={(e) => setForm({ ...form, creditHours: e.target.value })}
              className={inputCls}
              placeholder="3"
            />
          </div>
          <div>
            <label htmlFor="course-colour" className={labelCls}>Colour</label>
            <input
              id="course-colour"
              type="color"
              value={form.colour}
              onChange={(e) => setForm({ ...form, colour: e.target.value })}
              className="mt-1 h-10 w-20 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-600"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add course'}
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

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="course-search" className="sr-only">Search courses</label>
        <input
          id="course-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          placeholder="Search courses…"
        />
        <label htmlFor="course-semester-filter" className="sr-only">Filter by semester</label>
        <select
          id="course-semester-filter"
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="">All semesters</option>
          {semesters.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading courses…</p>
      ) : courses.length === 0 ? (
        <div className={`${cardCls} border-dashed`}>
          <h2 className="font-semibold">No courses yet</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Add your first course above — for example the subject you are studying this semester.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => (
            <li key={course._id} className={cardCls}>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 h-4 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: course.colour || '#4F46E5' }}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{course.title}</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {course.code ? `${course.code} · ` : ''}{course.semester}
                    {course.creditHours !== undefined && course.creditHours !== null
                      ? ` · ${course.creditHours} credit hours`
                      : ''}
                    {course.archived ? ' · Archived' : ''}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className={btnGhost} onClick={() => startEdit(course)}>
                  Edit
                </button>
                <button type="button" className={btnGhost} onClick={() => toggleArchive(course)}>
                  {course.archived ? 'Unarchive' : 'Archive'}
                </button>
                <button
                  type="button"
                  className={btnDanger}
                  disabled={deletingId === course._id}
                  onClick={() => handleDelete(course)}
                >
                  {deletingId === course._id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
