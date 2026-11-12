import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { coursesApi, notesApi } from '../lib/api.js';
import { btnDanger, btnGhost, btnPrimary, cardCls, inputCls, labelCls, selectCls, textareaCls } from '../lib/ui-classes.js';

function parseTags(text) {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | failed
  const [showPreview, setShowPreview] = useState(false);
  const savedSnapshot = useRef('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [noteData, courseData] = await Promise.all([
        notesApi.list({
          search: search.trim() || undefined,
          courseId: courseFilter || undefined,
          tag: tagFilter.trim() || undefined,
          archived: showArchived ? true : false,
          limit: 100,
        }),
        coursesApi.list({ limit: 100 }),
      ]);
      setNotes(noteData.notes);
      setCourses(courseData.courses);
    } catch (err) {
      setError(err.message || 'Could not load notes.');
    } finally {
      setLoading(false);
    }
  }, [search, courseFilter, tagFilter, showArchived]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  // Open a note in the editor.
  function openNote(note) {
    setSelectedId(note._id);
    const d = {
      title: note.title,
      contentMarkdown: note.contentMarkdown || '',
      tagsText: (note.tags || []).join(', '),
      courseId: note.courseId || '',
      pinned: !!note.pinned,
      archived: !!note.archived,
    };
    setDraft(d);
    savedSnapshot.current = JSON.stringify(d);
    setSaveState('idle');
  }

  // Debounced autosave: saves 800ms after the last edit.
  useEffect(() => {
    if (!selectedId || !draft) return;
    const snapshot = JSON.stringify(draft);
    if (snapshot === savedSnapshot.current) return;
    setSaveState('saving');
    const timer = setTimeout(async () => {
      try {
        await notesApi.update(selectedId, {
          title: draft.title.trim() || 'Untitled note',
          contentMarkdown: draft.contentMarkdown,
          tags: parseTags(draft.tagsText),
          courseId: draft.courseId || null,
          pinned: draft.pinned,
          archived: draft.archived,
        });
        savedSnapshot.current = snapshot;
        setSaveState('saved');
        setNotes((prev) =>
          prev.map((n) =>
            n._id === selectedId
              ? { ...n, title: draft.title.trim() || 'Untitled note', tags: parseTags(draft.tagsText), pinned: draft.pinned, archived: draft.archived }
              : n,
          ),
        );
      } catch {
        setSaveState('failed');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [draft, selectedId]);

  async function handleNew() {
    setError('');
    try {
      const { note } = await notesApi.create({ title: 'Untitled note' });
      setNotes((prev) => [note, ...prev]);
      openNote(note);
    } catch (err) {
      setError(err.message || 'Could not create the note.');
    }
  }

  async function handleDelete() {
    if (!selectedId || !window.confirm('Delete this note? This cannot be undone.')) return;
    try {
      await notesApi.remove(selectedId);
      setNotes((prev) => prev.filter((n) => n._id !== selectedId));
      setSelectedId(null);
      setDraft(null);
    } catch (err) {
      setError(err.message || 'Could not delete the note.');
    }
  }

  const previewHtml = useMemo(() => {
    if (!draft) return '';
    // marked output is passed through DOMPurify — raw user HTML is never
    // injected into the page unsanitized.
    const raw = marked.parse(draft.contentMarkdown || '', { async: false });
    return DOMPurify.sanitize(raw);
  }, [draft]);

  const courseName = (id) => courses.find((c) => c._id === id)?.title || 'No course';
  const allTags = [...new Set(notes.flatMap((n) => n.tags || []))].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Markdown notes with autosave. Edits save automatically about a second after you stop typing.
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={handleNew}>
          + New note
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="notes-search" className="sr-only">Search notes</label>
        <input
          id="notes-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          placeholder="Search notes…"
        />
        <label htmlFor="notes-course" className="sr-only">Filter by course</label>
        <select
          id="notes-course"
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c._id} value={c._id}>{c.title}</option>
          ))}
        </select>
        <label htmlFor="notes-tag" className="sr-only">Filter by tag</label>
        <select
          id="notes-tag"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Note list */}
        <div className="space-y-2 lg:col-span-2">
          {loading ? (
            <p className="text-sm text-slate-500">Loading notes…</p>
          ) : notes.length === 0 ? (
            <div className={`${cardCls} border-dashed`}>
              <h2 className="font-semibold">No notes yet</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Create your first note with the button above, then write in Markdown — headings, lists and links all work.
              </p>
            </div>
          ) : (
            notes.map((note) => (
              <button
                key={note._id}
                type="button"
                onClick={() => openNote(note)}
                className={`w-full rounded-xl border p-4 text-left ${
                  selectedId === note._id
                    ? 'border-brand-500 bg-brand-50 dark:bg-slate-800'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800'
                }`}
              >
                <span className="block font-semibold">
                  {note.pinned ? '📌 ' : ''}{note.title}
                </span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  {courseName(note.courseId)} · {new Date(note.updatedAt).toLocaleDateString()}
                  {(note.tags || []).length > 0 ? ` · ${(note.tags || []).join(', ')}` : ''}
                  {note.archived ? ' · Archived' : ''}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-3">
          {!draft ? (
            <div className={`${cardCls} border-dashed`}>
              <h2 className="font-semibold">Select a note to edit</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Pick a note from the list, or create a new one.
              </p>
            </div>
          ) : (
            <div className={`${cardCls} space-y-4`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
                  {saveState === 'saving' && 'Saving…'}
                  {saveState === 'saved' && '✓ Saved'}
                  {saveState === 'failed' && '⚠ Save failed — check your connection and keep typing; it will retry.'}
                  {saveState === 'idle' && 'Edits save automatically'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setShowPreview((v) => !v)}
                    aria-pressed={showPreview}
                  >
                    {showPreview ? 'Edit' : 'Preview'}
                  </button>
                  <button type="button" className={btnDanger} onClick={handleDelete}>
                    Delete
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="note-title" className={labelCls}>Title</label>
                <input
                  id="note-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="note-course" className={labelCls}>Course</label>
                  <select
                    id="note-course"
                    value={draft.courseId}
                    onChange={(e) => setDraft({ ...draft, courseId: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">No course</option>
                    {courses.map((c) => (
                      <option key={c._id} value={c._id}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="note-tags" className={labelCls}>Tags (comma-separated)</label>
                  <input
                    id="note-tags"
                    value={draft.tagsText}
                    onChange={(e) => setDraft({ ...draft, tagsText: e.target.value })}
                    className={inputCls}
                    placeholder="exam, chapter-4"
                  />
                </div>
              </div>

              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.pinned}
                    onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
                  />
                  Pinned
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.archived}
                    onChange={(e) => setDraft({ ...draft, archived: e.target.checked })}
                  />
                  Archived
                </label>
              </div>

              {showPreview ? (
                <div>
                  <p className="text-sm font-medium">Preview</p>
                  <div
                    className="mt-1 max-w-none space-y-2 rounded-lg border border-slate-200 p-4 text-sm leading-relaxed dark:border-slate-700 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:font-semibold [&_a]:text-brand-600 [&_a]:underline [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 dark:[&_code]:bg-slate-800 [&_li]:ml-5 [&_li]:list-disc [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-3 dark:[&_pre]:bg-slate-800"
                    // Sanitized with DOMPurify above — never raw user HTML.
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="note-content" className={labelCls}>Content (Markdown)</label>
                  <textarea
                    id="note-content"
                    rows={14}
                    value={draft.contentMarkdown}
                    onChange={(e) => setDraft({ ...draft, contentMarkdown: e.target.value })}
                    className={`${textareaCls} font-mono`}
                    placeholder={'# Heading\n\nWrite your notes here…'}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
