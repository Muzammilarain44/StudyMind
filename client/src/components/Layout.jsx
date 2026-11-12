import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { settingsApi } from '../lib/api.js';
import { applyTheme, readStoredTheme } from '../lib/theme.js';

function ThemeToggle({ user }) {
  const [dark, setDark] = useState(() => readStoredTheme() === 'dark');

  // The server-side theme is the source of truth: when the logged-in user
  // loads, adopt their saved theme (e.g. set on another device).
  useEffect(() => {
    if (user?.theme) {
      const serverDark = user.theme === 'dark';
      setDark((current) => {
        if (current !== serverDark) applyTheme(user.theme);
        return serverDark;
      });
    }
  }, [user]);

  useEffect(() => {
    applyTheme(dark ? 'dark' : 'light');
  }, [dark]);

  async function toggle() {
    const next = !dark;
    setDark(next);
    // Persist the choice to the server too (best effort — the local
    // toggle already applied, so a failed request is not an error here).
    if (user) {
      try {
        await settingsApi.update({ theme: next ? 'dark' : 'light' });
      } catch {
        // Ignore: theme is already applied locally.
      }
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {dark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}

function navClass({ isActive }) {
  return `shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-white'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;
}

function sidebarClass({ isActive }) {
  return `block rounded-lg px-3 py-2 text-sm font-medium ${
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-white'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isLanding = location.pathname === '/';

  const NAV = user
    ? [
        { to: '/', label: 'Home' },
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/courses', label: 'Courses' },
        { to: '/notes', label: 'Notes' },
        { to: '/planner', label: 'Planner' },
        { to: '/quizzes', label: 'Quizzes' },
        { to: '/flashcards', label: 'Flashcards' },
        { to: '/pomodoro', label: 'Pomodoro' },
        { to: '/gpa', label: 'GPA' },
        { to: '/analytics', label: 'Analytics' },
        { to: '/settings', label: 'Settings' },
        ...(user.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
        { to: '/profile', label: 'Profile' },
      ]
    : [
        { to: '/', label: 'Home' },
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/login', label: 'Login' },
        { to: '/register', label: 'Register' },
      ];

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="shrink-0 text-xl font-bold text-brand-600 dark:text-brand-100">
            📚 StudyMind
          </Link>
          {/* Topbar nav scrolls horizontally instead of overflowing: with 13
              links it is wider than the max-w-6xl container at 1280px, which
              used to push the theme toggle 20px past the viewport edge. */}
          <nav aria-label="Main navigation" className="no-scrollbar hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:flex">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Log out
              </button>
            )}
          </nav>
          <ThemeToggle user={user} />
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* Desktop sidebar — hidden on mobile, hidden on landing for a clean hero */}
        {!isLanding && (
          <aside className="hidden w-56 shrink-0 md:block" aria-label="Sidebar">
            <nav className="sticky top-20 space-y-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Workspace</p>
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className={sidebarClass}>
                  {item.label}
                </NavLink>
              ))}
              {user && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Log out
                </button>
              )}
              <p className="px-2 pt-4 text-xs leading-relaxed text-slate-400">
                All six phases are built: courses, notes, planner, quizzes, flashcards, Pomodoro, GPA, analytics, settings and admin.
              </p>
            </nav>
          </aside>
        )}

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation — horizontally scrollable: there are 13
          links when logged in, and a fixed row would overflow a phone screen
          (390px). Scrolling keeps every page reachable without overflow. */}
      <nav
        aria-label="Mobile navigation"
        className="no-scrollbar fixed inset-x-0 bottom-0 z-10 flex overflow-x-auto border-t border-slate-200 bg-white py-2 dark:border-slate-800 dark:bg-slate-900 md:hidden"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `shrink-0 whitespace-nowrap rounded-lg px-3 py-1 text-sm font-medium ${isActive ? 'text-brand-600 dark:text-brand-100' : 'text-slate-500 dark:text-slate-400'}`
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
