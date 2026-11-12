import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/login', label: 'Login' },
  { to: '/register', label: 'Register' },
];

function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem('studymind-theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('studymind-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {dark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}

export default function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="text-xl font-bold text-brand-600 dark:text-brand-100">
            📚 StudyMind
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* Desktop sidebar — hidden on mobile, hidden on landing for a clean hero */}
        {!isLanding && (
          <aside className="hidden w-56 shrink-0 md:block" aria-label="Sidebar">
            <nav className="sticky top-20 space-y-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Workspace</p>
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <p className="px-2 pt-4 text-xs leading-relaxed text-slate-400">
                Courses, notes, quizzes and more arrive in Phases 3–5.
              </p>
            </nav>
          </aside>
        )}

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-slate-200 bg-white py-2 dark:border-slate-800 dark:bg-slate-900 md:hidden"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-1 text-sm font-medium ${isActive ? 'text-brand-600 dark:text-brand-100' : 'text-slate-500 dark:text-slate-400'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      {/* Spacer so content is not hidden behind the mobile nav */}
      <div className="h-12 md:hidden" aria-hidden="true" />
    </div>
  );
}
