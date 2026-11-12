import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Log in</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Authentication is coming in Phase 2. This form does not log anyone in yet.
      </p>
      <form
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        onSubmit={(e) => e.preventDefault()}
      >
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled
          title="Coming in Phase 2"
          className="w-full cursor-not-allowed rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white opacity-60"
        >
          Log in — coming in Phase 2
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
        No account yet? <Link to="/register" className="font-medium text-brand-600 dark:text-brand-100">Register</Link>
      </p>
    </div>
  );
}
