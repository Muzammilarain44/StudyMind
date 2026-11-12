import { useContext } from 'react';
import { AuthContext } from './auth-context.js';

/**
 * Read the auth state. Lives in its own file (no components here) so that
 * auth.jsx only exports the AuthProvider component — this is what the
 * react-refresh/only-export-components lint rule requires.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider.');
  return ctx;
}
