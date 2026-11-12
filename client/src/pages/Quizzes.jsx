import { useCallback, useEffect, useRef, useState } from 'react';
import { coursesApi, quizzesApi } from '../lib/api.js';
import { btnDanger, btnGhost, btnPrimary, cardCls, inputCls, labelCls, selectCls } from '../lib/ui-classes.js';

const EMPTY_QUIZ = { title: '', description: '', courseId: '', timeLimitMinutes: '' };
const EMPTY_QUESTION = { question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' };

function formatSeconds(total) {
  const s = Math.max(0, total);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function Quizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState(EMPTY_QUIZ);
  const [questions, setQuestions] = useState([]);
  const [draft, setDraft] = useState(EMPTY_QUESTION);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Taking a quiz
  const [taking, setTaking] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [takeStartedAt, setTakeStartedAt] = useState(null);
  const submitRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [quizData, courseData, statsData] = await Promise.all([
        quizzesApi.list({ search: search.trim() || undefined, limit: 100 }),
        coursesApi.list({ limit: 100 }),
        quizzesApi.stats(),
      ]);
      setQuizzes(quizData.quizzes);
      setCourses(courseData.courses);
      setStats(statsData);
    } catch (err) {
      setError(err.message || 'Could not load quizzes.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Create / edit ----

  function addQuestion() {
    if (!draft.question.trim()) {
      setError('Write the question text before adding it.');
      return;
    }
    const options = draft.options.map((o) => o.trim());
    if (options.some((o) => !o)) {
      setError('Every option must have text. Remove empty option fields first.');
      return;
    }
    setQuestions([
      ...questions,
      { question: draft.question.trim(), options, correctIndex: draft.correctIndex, explanation: draft.explanation.trim() },
    ]);
    setDraft(EMPTY_QUESTION);
    setError('');
  }

  function removeQuestion(index) {
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function startEdit(quiz) {
    setEditing(quiz);
    setForm({
      title: quiz.title,
      description: quiz.description || '',
      courseId: quiz.courseId || '',
      timeLimitMinutes: quiz.timeLimitSeconds ? String(Math.round(quiz.timeLimitSeconds / 60)) : '',
    });
    setQuestions(quiz.questions || []);
    setDraft(EMPTY_QUESTION);
    setTaking(null);
    setResult(null);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (questions.length === 0) {
      setError('Add at least one question before saving the quiz.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        courseId: form.courseId || null,
        timeLimitSeconds:
          form.timeLimitMinutes === '' ? null : Math.max(1, Math.round(Number(form.timeLimitMinutes) * 60)),
        questions,
      };
      if (editing) {
        await quizzesApi.update(editing._id, body);
      } else {
        await quizzesApi.create(body);
      }
      setForm(EMPTY_QUIZ);
      setQuestions([]);
      setDraft(EMPTY_QUESTION);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not save the quiz.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(quiz) {
    if (!window.confirm(`Delete the quiz "${quiz.title}"? Its attempt history will be deleted too.`)) return;
    setDeletingId(quiz._id);
    try {
      await quizzesApi.remove(quiz._id);
      if (taking && taking._id === quiz._id) {
        setTaking(null);
        setResult(null);
      }
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete the quiz.');
    } finally {
      setDeletingId(null);
    }
  }

  // ---- Taking a quiz ----

  async function startTaking(quiz) {
    setError('');
    try {
      const full = await quizzesApi.get(quiz._id);
      const attempts = await quizzesApi.attempts(quiz._id, { limit: 20 });
      setTaking(full.quiz);
      setHistory(attempts.attempts);
      setAnswers({});
      setResult(null);
      setTakeStartedAt(Date.now());
      setRemaining(full.quiz.timeLimitSeconds || null);
    } catch (err) {
      setError(err.message || 'Could not open the quiz.');
    }
  }

  const submitAttempt = useCallback(
    async (quiz, currentAnswers, startedAt) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const ordered = quiz.questions.map((_, i) => currentAnswers[i] ?? 0);
        const timeTakenSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : null;
        const data = await quizzesApi.submitAttempt(quiz._id, { answers: ordered, timeTakenSeconds });
        setResult(data);
        const attempts = await quizzesApi.attempts(quiz._id, { limit: 20 });
        setHistory(attempts.attempts);
        const statsData = await quizzesApi.stats();
        setStats(statsData);
      } catch (err) {
        setError(err.message || 'Could not submit the attempt.');
      } finally {
        setSubmitting(false);
      }
    },
    [submitting],
  );
  submitRef.current = submitAttempt;

  // Optional timer: counts down and auto-submits at zero.
  useEffect(() => {
    if (!taking || result || remaining === null) return undefined;
    if (remaining <= 0) {
      submitRef.current(taking, answers, takeStartedAt);
      return undefined;
    }
    const id = setInterval(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearInterval(id);
  }, [taking, result, remaining, answers, takeStartedAt]);

  const answeredCount = taking ? taking.questions.filter((_, i) => answers[i] !== undefined).length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quizzes</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Build your own MCQ question banks, take them with an optional timer, and see graded
          results with explanations. Questions are yours — nothing is generated by AI.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className={cardCls}>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Quizzes</dt>
            <dd className="text-2xl font-bold">{stats.totalQuizzes}</dd>
          </div>
          <div className={cardCls}>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Attempts</dt>
            <dd className="text-2xl font-bold">{stats.totalAttempts}</dd>
          </div>
          <div className={cardCls}>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Average score</dt>
            <dd className="text-2xl font-bold">{stats.averagePercentage === null ? '—' : `${stats.averagePercentage}%`}</dd>
          </div>
          <div className={cardCls}>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Best score</dt>
            <dd className="text-2xl font-bold">{stats.bestPercentage === null ? '—' : `${stats.bestPercentage}%`}</dd>
          </div>
        </div>
      )}

      {/* ---- Take quiz view ---- */}
      {taking && (
        <section className={`${cardCls} space-y-4`} aria-label={`Take quiz: ${taking.title}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{taking.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {taking.questions.length} questions
                {taking.timeLimitSeconds ? ` · ${Math.round(taking.timeLimitSeconds / 60)} minute timer` : ' · No timer'}
              </p>
            </div>
            <button type="button" className={btnGhost} onClick={() => { setTaking(null); setResult(null); }}>
              Close quiz
            </button>
          </div>

          {remaining !== null && !result && (
            <p className="text-sm font-semibold" role="timer" aria-label="Time remaining">
              Time left: {formatSeconds(remaining)}
            </p>
          )}

          {result ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-brand-50 p-4 dark:bg-slate-800">
                <p className="text-lg font-bold">
                  Score: {result.attempt.score} / {result.attempt.total} ({result.attempt.percentage}%)
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Completed {new Date(result.attempt.completedAt).toLocaleString()}
                  {result.attempt.timeTakenSeconds !== null && result.attempt.timeTakenSeconds !== undefined
                    ? ` · Took ${formatSeconds(result.attempt.timeTakenSeconds)}`
                    : ''}
                </p>
              </div>
              <ol className="space-y-3">
                {result.results.map((r) => (
                  <li key={r.questionIndex} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <p className="font-medium">
                      {r.correct ? '✅ ' : '❌ '}{r.question}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Your answer: {taking.questions[r.questionIndex].options[r.selected]} · Correct answer:{' '}
                      {taking.questions[r.questionIndex].options[r.correctIndex]}
                    </p>
                    {r.explanation && <p className="mt-1 text-sm">Why: {r.explanation}</p>}
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className={btnPrimary}
                onClick={() => { setResult(null); setAnswers({}); setRemaining(taking.timeLimitSeconds || null); setTakeStartedAt(Date.now()); }}
              >
                Retake quiz
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAttempt(taking, answers, takeStartedAt);
              }}
              className="space-y-5"
            >
              {taking.questions.map((q, qi) => (
                <fieldset key={qi} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <legend className="px-1 font-medium">
                    {qi + 1}. {q.question}
                  </legend>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`q-${qi}`}
                          checked={answers[qi] === oi}
                          onChange={() => setAnswers({ ...answers, [qi]: oi })}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <button type="submit" disabled={submitting || answeredCount < taking.questions.length} className={btnPrimary}>
                {submitting ? 'Submitting…' : `Submit (${answeredCount} / ${taking.questions.length} answered)`}
              </button>
            </form>
          )}

          {history.length > 0 && (
            <div>
              <h3 className="font-semibold">Attempt history</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {history.map((a) => (
                  <li key={a._id} className="flex justify-between gap-3">
                    <span>{new Date(a.completedAt).toLocaleString()}</span>
                    <span className="font-medium">{a.score} / {a.total} ({a.percentage}%)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ---- Create / edit form ---- */}
      <form onSubmit={handleSubmit} className={`${cardCls} space-y-4`} aria-label={editing ? 'Edit quiz' : 'New quiz'}>
        <h2 className="font-semibold">{editing ? `Edit quiz: ${editing.title}` : 'New quiz'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="quiz-title" className={labelCls}>Title</label>
            <input id="quiz-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="CS Basics" />
          </div>
          <div>
            <label htmlFor="quiz-course" className={labelCls}>Course (optional)</label>
            <select id="quiz-course" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} className={selectCls}>
              <option value="">No course</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="quiz-timer" className={labelCls}>Timer in minutes (optional)</label>
            <input id="quiz-timer" type="number" min="1" max="240" value={form.timeLimitMinutes} onChange={(e) => setForm({ ...form, timeLimitMinutes: e.target.value })} className={inputCls} placeholder="Leave empty for no timer" />
          </div>
          <div>
            <label htmlFor="quiz-description" className={labelCls}>Description (optional)</label>
            <input id="quiz-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} placeholder="What this quiz covers" />
          </div>
        </div>

        <div>
          <h3 className="font-medium">Questions ({questions.length})</h3>
          {questions.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">No questions yet — add one below.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <span>
                    <span className="font-medium">{i + 1}. {q.question}</span>
                    <span className="block text-slate-600 dark:text-slate-400">
                      Correct: {q.options[q.correctIndex]}{q.explanation ? ` · ${q.explanation}` : ''}
                    </span>
                  </span>
                  <button type="button" className={btnGhost} onClick={() => removeQuestion(i)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <h3 className="font-medium">Add a question</h3>
          <div>
            <label htmlFor="q-text" className={labelCls}>Question</label>
            <input id="q-text" value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} className={inputCls} placeholder="What does CPU stand for?" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {draft.options.map((opt, oi) => (
              <div key={oi}>
                <label htmlFor={`q-opt-${oi}`} className={labelCls}>
                  Option {String.fromCharCode(65 + oi)}
                  {draft.correctIndex === oi ? ' (correct)' : ''}
                </label>
                <input
                  id={`q-opt-${oi}`}
                  value={opt}
                  onChange={(e) => {
                    const options = [...draft.options];
                    options[oi] = e.target.value;
                    setDraft({ ...draft, options });
                  }}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="q-correct" className={labelCls}>Correct option</label>
              <select id="q-correct" value={draft.correctIndex} onChange={(e) => setDraft({ ...draft, correctIndex: Number(e.target.value) })} className={selectCls}>
                {draft.options.map((_, oi) => (
                  <option key={oi} value={oi}>Option {String.fromCharCode(65 + oi)}</option>
                ))}
              </select>
            </div>
            <div className="min-w-56 flex-1">
              <label htmlFor="q-explanation" className={labelCls}>Explanation (optional, shown after submit)</label>
              <input id="q-explanation" value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} className={inputCls} placeholder="Why this answer is right" />
            </div>
            <button type="button" className={btnGhost} onClick={addQuestion}>Add question</button>
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create quiz'}
          </button>
          {editing && (
            <button
              type="button"
              className={btnGhost}
              onClick={() => { setEditing(null); setForm(EMPTY_QUIZ); setQuestions([]); setDraft(EMPTY_QUESTION); }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* ---- Quiz list ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="quiz-search" className="sr-only">Search quizzes</label>
        <input
          id="quiz-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
          placeholder="Search quizzes…"
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading quizzes…</p>
      ) : quizzes.length === 0 ? (
        <div className={`${cardCls} border-dashed`}>
          <h2 className="font-semibold">No quizzes yet</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Create your first quiz above — add a question, mark the correct option, and take it.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {quizzes.map((quiz) => (
            <li key={quiz._id} className={cardCls}>
              <h2 className="font-semibold">{quiz.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}
                {quiz.timeLimitSeconds ? ` · ${Math.round(quiz.timeLimitSeconds / 60)} min timer` : ' · No timer'}
                {quiz.description ? ` · ${quiz.description}` : ''}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={() => startTaking(quiz)}>Take quiz</button>
                <button type="button" className={btnGhost} onClick={async () => {
                  const full = await quizzesApi.get(quiz._id);
                  startEdit(full.quiz);
                }}>Edit</button>
                <button
                  type="button"
                  className={btnDanger}
                  disabled={deletingId === quiz._id}
                  onClick={() => handleDelete(quiz)}
                >
                  {deletingId === quiz._id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {stats && stats.byCourse.length > 0 && (
        <section className={cardCls} aria-label="Quiz stats by course">
          <h2 className="font-semibold">Stats by course</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {stats.byCourse.map((c) => (
              <li key={c.courseId || 'none'} className="flex justify-between gap-3">
                <span className="font-medium">{c.courseTitle}</span>
                <span className="text-slate-600 dark:text-slate-400">
                  {c.attempts} attempt{c.attempts === 1 ? '' : 's'} · {c.averagePercentage}% average
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
