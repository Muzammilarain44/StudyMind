import { Link } from 'react-router-dom';

const FEATURES = [
  { title: 'Courses & Notes', text: 'Organise subjects and keep searchable notes in one place.' },
  { title: 'Planner & Pomodoro', text: 'Tasks with due dates and focused study sessions.' },
  { title: 'Quizzes & Flashcards', text: 'Test yourself with MCQ quizzes and spaced-repetition decks.' },
  { title: 'GPA & Analytics', text: 'Credit-weighted GPA estimates and real charts from your own data.' },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 px-6 py-12 text-white sm:px-10">
        <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">Your study workspace, in one place.</h1>
        <p className="mt-4 max-w-xl text-indigo-100">
          StudyMind helps university and college students organise courses, notes, tasks, quizzes,
          flashcards and study time — with real data, not fake numbers.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/register" className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
            Get started
          </Link>
          <Link to="/dashboard" className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
            View dashboard
          </Link>
        </div>
        <p className="mt-4 text-xs text-indigo-200">
          Phase 2: auth is live. Courses, notes and the rest arrive in later phases.
        </p>
      </section>

      <section aria-label="Features">
        <h2 className="text-2xl font-bold">What StudyMind will do</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{f.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
