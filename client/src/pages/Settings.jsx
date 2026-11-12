import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadExport, settingsApi } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { applyTheme } from '../lib/theme.js';
import { btnDanger, btnGhost, btnPrimary, cardCls, inputCls, labelCls, selectCls } from '../lib/ui-classes.js';

const COMMON_TIMEZONES = [
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'UTC',
];

export default function Settings() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(user?.theme || 'light');
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Karachi');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState('');
  const [password, setPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  if (!user) return null;

  async function handleSavePreferences(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await settingsApi.update({ theme, timezone });
      applyTheme(theme);
      // Refresh the auth context so Profile (and the Layout theme toggle)
      // show the new values immediately — no page reload needed.
      await refresh();
      setMessage('Preferences saved.');
    } catch (err) {
      setError(err.message || 'Could not save preferences.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(format) {
    setError('');
    setExportBusy(format);
    try {
      await downloadExport(format);
    } catch (err) {
      setError(err.message || 'Export failed.');
    } finally {
      setExportBusy('');
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    setError('');
    if (!confirmDelete) {
      setError('Tick the confirmation box to delete your account.');
      return;
    }
    if (!window.confirm('This permanently deletes your account and ALL your data. Are you sure?')) return;
    setDeleteBusy(true);
    try {
      await settingsApi.deleteAccount({ password });
      navigate('/register', { replace: true });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Could not delete your account.');
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Preferences, your data export, and account controls.
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

      {/* Preferences */}
      <section className={cardCls}>
        <h2 className="font-semibold">Preferences</h2>
        <form className="mt-4 space-y-4" onSubmit={handleSavePreferences}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-theme" className={labelCls}>Theme</label>
              <select
                id="settings-theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className={selectCls}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div>
              <label htmlFor="settings-timezone" className={labelCls}>Timezone</label>
              <input
                id="settings-timezone"
                list="timezone-options"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className={inputCls}
                placeholder="Asia/Karachi"
              />
              <datalist id="timezone-options">
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dates are stored in UTC and shown in your timezone. Your grading scale lives on the
            GPA page.
          </p>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? 'Saving…' : 'Save preferences'}
          </button>
        </form>
      </section>

      {/* Data export */}
      <section className={cardCls}>
        <h2 className="font-semibold">Export your data</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Download everything you created in StudyMind — courses, notes, tasks, quizzes,
          flashcards, study sessions and GPA records. Only your own data is included.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleExport('json')}
            disabled={exportBusy !== ''}
            className={btnPrimary}
          >
            {exportBusy === 'json' ? 'Preparing…' : 'Download JSON'}
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={exportBusy !== ''}
            className={btnGhost}
          >
            {exportBusy === 'csv' ? 'Preparing…' : 'Download CSV'}
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border border-red-200 bg-white p-5 dark:border-red-900 dark:bg-slate-900">
        <h2 className="font-semibold text-red-700 dark:text-red-300">Delete account</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          This permanently deletes your account and all of your data: courses, notes, tasks,
          quizzes, flashcards, sessions and GPA records. Sample quizzes and curated subjects you
          created as an admin stay available to other users. This cannot be undone.
        </p>
        <form className="mt-4 space-y-4" onSubmit={handleDeleteAccount}>
          <div>
            <label htmlFor="delete-password" className={labelCls}>Confirm with your password</label>
            <input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="Your current password"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.checked)}
              className="mt-0.5"
            />
            <span>I understand that my account and all my data will be permanently deleted.</span>
          </label>
          <button type="submit" disabled={deleteBusy} className={btnDanger}>
            {deleteBusy ? 'Deleting…' : 'Delete my account'}
          </button>
        </form>
      </section>
    </div>
  );
}
