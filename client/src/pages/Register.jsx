import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Registration is coming in Phase 2. This form does not create an account yet.
      </p>
      <form
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        onSubmit={(e) => e.preventDefault()}
      >
        <div>
          <label htmlFor="register-name" className="block text-sm font-medium">Full name</label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="register-email" className="block text-sm font-medium">Email</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="register-password" className="block text-sm font-medium">Password</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            placeholder="At least 8 characters"
          />
        </div>
        <button
          type="submit"
          disabled
          title="Coming in Phase 2"
          className="w-full cursor-not-allowed rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white opacity-60"
        >
          Create account — coming in Phase 2
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
        Already have an account? <Link to="/login" className="font-medium text-brand-600 dark:text-brand-100">Log in</Link>
      </p>
    </div>
  );
}
