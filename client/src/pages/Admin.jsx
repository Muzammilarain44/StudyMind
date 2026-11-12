import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../lib/api.js';
import { useAuth } from '../lib/use-auth.js';
import { btnDanger, btnGhost, btnPrimary, cardCls, inputCls, labelCls, selectCls, textareaCls } from '../lib/ui-classes.js';

const emptySubject = { title: '', code: '', category: 'Computer Science', description: '' };
const emptyQuestion = { question: '', optionsText: '', correctIndex: 0, explanation: '' };

export default function Admin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [subjectForm, setSubjectForm] = useState(emptySubject);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [quizForm, setQuizForm] = useState({ title: '', description: '' });
  const [questions, setQuestions] = useState([]);
  const [questionForm, setQuestionForm] = useState(emptyQuestion);
  const [quizBusy, setQuizBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [subjectList, sampleList] = await Promise.all([
        adminApi.listSubjects({ limit: 100 }),
        adminApi.listSamples({ limit: 100 }),
      ]);
      setSubjects(subjectList.subjects || []);
      setSamples(sampleList.quizzes || []);
      try {
        const statsData = await adminApi.stats();
        setStats(statsData);
        setIsAdmin(true);
      } catch {
        setIsAdmin(false);
        setStats(null);
      }
    } catch (err) {
      setError(err.message || 'Could not load the admin panel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubjectSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (editingSubjectId) {
        await adminApi.updateSubject(editingSubjectId, subjectForm);
        setMessage('Subject updated.');
      } else {
        await adminApi.createSubject(subjectForm);
        setMessage('Subject added.');
      }
      setSubjectForm(emptySubject);
      setEditingSubjectId(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not save the subject.');
    } finally {
      setBusy(false);
    }
  }

  function handleSubjectEdit(subject) {
    setEditingSubjectId(subject._id);
    setSubjectForm({
      title: subject.title,
      code: subject.code || '',
      category: subject.category || 'Computer Science',
      description: subject.description || '',
    });
    setMessage('');
    setError('');
  }

  async function handleSubjectDelete(id) {
    if (!window.confirm('Delete this curated subject?')) return;
    try {
      await adminApi.removeSubject(id);
      setMessage('Subject deleted.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete the subject.');
    }
  }

  function handleAddQuestion() {
    const options = questionForm.optionsText
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);
    if (!questionForm.question.trim()) {
      setError('Question text is required.');
      return;
    }
    if (options.length < 2 || options.length > 6) {
      setError('Each question needs between 2 and 6 options (one per line).');
      return;
    }
    if (questionForm.correctIndex < 0 || questionForm.correctIndex >= options.length) {
      setError('The correct option must be one of the listed options.');
      return;
    }
    setError('');
    setQuestions([
      ...questions,
      {
        question: questionForm.question.trim(),
        options,
        correctIndex: questionForm.correctIndex,
        explanation: questionForm.explanation.trim(),
      },
    ]);
    setQuestionForm(emptyQuestion);
  }

  async function handleSampleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (questions.length < 1) {
      setError('Add at least one question to the sample quiz.');
      return;
    }
    setQuizBusy(true);
    try {
      await adminApi.createSample({
        title: quizForm.title.trim(),
        description: quizForm.description.trim(),
        questions,
      });
      setMessage('Sample quiz created.');
      setQuizForm({ title: '', description: '' });
      setQuestions([]);
      await load();
    } catch (err) {
      setError(err.message || 'Could not create the sample quiz.');
    } finally {
      setQuizBusy(false);
    }
  }

  async function handleSampleDelete(id) {
    if (!window.confirm('Delete this sample quiz?')) return;
    try {
      await adminApi.removeSample(id);
      setMessage('Sample quiz deleted.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete the sample quiz.');
    }
  }

  async function handleCopySample(id) {
    setError('');
    try {
      await adminApi.copySample(id);
      setMessage('Sample copied to your quizzes. Find it on the Quizzes page.');
    } catch (err) {
      setError(err.message || 'Could not copy the sample quiz.');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {isAdmin
            ? 'Platform management: usage counts, curated subjects and sample quiz banks.'
            : 'You are not an admin. You can still browse and copy the sample quiz banks below.'}
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

      {isAdmin && stats && (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-label="Usage counts">
          {[
            { label: 'Users', value: stats.users },
            { label: 'Courses', value: stats.courses },
            { label: 'Notes', value: stats.notes },
            { label: 'Tasks', value: stats.tasks },
            { label: 'Quizzes', value: stats.quizzes },
            { label: 'Quiz attempts', value: stats.quizAttempts },
            { label: 'Flashcard decks', value: stats.flashcardDecks },
            { label: 'Study sessions', value: stats.studySessions },
            { label: 'GPA records', value: stats.gpaRecords },
            { label: 'Curated subjects', value: stats.curatedSubjects },
          ].map((stat) => (
            <div key={stat.label} className={cardCls}>
              <dt className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</dt>
              <dd className="text-2xl font-bold">{stat.value}</dd>
            </div>
          ))}
          <p className="col-span-full text-xs text-slate-500 dark:text-slate-400">
            Counts only — admins never see private student notes or quiz answers here.
          </p>
        </section>
      )}

      {/* Curated subjects */}
      <section className={cardCls}>
        <h2 className="font-semibold">Curated subjects ({subjects.length})</h2>
        {subjects.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            No curated subjects yet. {isAdmin ? 'Add the first one below.' : ''}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {subjects.map((s) => (
              <li key={s._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">
                    {s.title} {s.code ? <span className="text-sm text-slate-500">({s.code})</span> : null}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {s.category}
                    {s.description ? ` — ${s.description}` : ''}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleSubjectEdit(s)} className={btnGhost}>
                      Edit
                    </button>
                    <button type="button" onClick={() => handleSubjectDelete(s._id)} className={btnDanger}>
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <form className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800" onSubmit={handleSubjectSubmit}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="subject-title" className={labelCls}>Title</label>
                <input
                  id="subject-title"
                  required
                  value={subjectForm.title}
                  onChange={(e) => setSubjectForm({ ...subjectForm, title: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Data Structures"
                />
              </div>
              <div>
                <label htmlFor="subject-code" className={labelCls}>Code</label>
                <input
                  id="subject-code"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. CS-201"
                />
              </div>
              <div>
                <label htmlFor="subject-category" className={labelCls}>Category</label>
                <input
                  id="subject-category"
                  value={subjectForm.category}
                  onChange={(e) => setSubjectForm({ ...subjectForm, category: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label htmlFor="subject-description" className={labelCls}>Description</label>
              <textarea
                id="subject-description"
                rows={2}
                value={subjectForm.description}
                onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                className={textareaCls}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? 'Saving…' : editingSubjectId ? 'Update subject' : 'Add subject'}
              </button>
              {editingSubjectId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSubjectId(null);
                    setSubjectForm(emptySubject);
                  }}
                  className={btnGhost}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      {/* Sample quiz banks */}
      <section className={cardCls}>
        <h2 className="font-semibold">Sample quiz banks ({samples.length})</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {isAdmin
            ? 'Samples are platform content. Students browse them without answers and copy them into their own quizzes.'
            : 'Browse the samples and copy one into your own quizzes to take it.'}
        </p>
        {samples.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No sample quizzes yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {samples.map((q) => (
              <li key={q._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">{q.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {q.questionCount} questions{q.description ? ` — ${q.description}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleCopySample(q._id)} className={btnGhost}>
                    Copy to my quizzes
                  </button>
                  {isAdmin && (
                    <button type="button" onClick={() => handleSampleDelete(q._id)} className={btnDanger}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <form className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800" onSubmit={handleSampleSubmit}>
            <h3 className="font-semibold">Create a sample quiz</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="sample-title" className={labelCls}>Title</label>
                <input
                  id="sample-title"
                  required
                  value={quizForm.title}
                  onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Sample: CS Basics"
                />
              </div>
              <div>
                <label htmlFor="sample-description" className={labelCls}>Description</label>
                <input
                  id="sample-description"
                  value={quizForm.description}
                  onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            {questions.length > 0 && (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {questions.map((q, i) => (
                  <li key={i}>
                    {q.question} <span className="text-slate-500">({q.options.length} options, correct: {q.correctIndex + 1})</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <p className="text-sm font-medium">Add a question</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor="sample-question" className={labelCls}>Question</label>
                  <input
                    id="sample-question"
                    value={questionForm.question}
                    onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="sample-options" className={labelCls}>Options (one per line, 2–6)</label>
                  <textarea
                    id="sample-options"
                    rows={3}
                    value={questionForm.optionsText}
                    onChange={(e) => setQuestionForm({ ...questionForm, optionsText: e.target.value })}
                    className={textareaCls}
                    placeholder={'Central Processing Unit\nComputer Personal Unit'}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="sample-correct" className={labelCls}>Correct option</label>
                    <select
                      id="sample-correct"
                      value={questionForm.correctIndex}
                      onChange={(e) => setQuestionForm({ ...questionForm, correctIndex: Number(e.target.value) })}
                      className={selectCls}
                    >
                      {questionForm.optionsText
                        .split('\n')
                        .map((o) => o.trim())
                        .filter(Boolean)
                        .map((o, i) => (
                          <option key={i} value={i}>
                            Option {i + 1}: {o.slice(0, 40)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sample-explanation" className={labelCls}>Explanation (optional)</label>
                    <input
                      id="sample-explanation"
                      value={questionForm.explanation}
                      onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>
                <button type="button" onClick={handleAddQuestion} className={btnGhost}>
                  Add question
                </button>
              </div>
            </div>
            <button type="submit" disabled={quizBusy} className={btnPrimary}>
              {quizBusy ? 'Creating…' : `Create sample quiz (${questions.length} questions)`}
            </button>
          </form>
        )}
      </section>

      {!isAdmin && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Admin access is granted only by the project owner (see docs/setup.md). There is no
          self-registration for admins. Signed in as {user?.email}.
        </p>
      )}
    </div>
  );
}
