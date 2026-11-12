import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const AuthContext = createContext(null);

async function authFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}/api/v1/auth${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (HTTP ${res.status}).`);
  }
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Session restore on app load.
  useEffect(() => {
    let cancelled = false;
    authFetch('/me')
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setError('');
    const data = await authFetch('/login', { method: 'POST', body: { email, password } });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    setError('');
    const data = await authFetch('/register', { method: 'POST', body: { name, email, password } });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authFetch('/logout', { method: 'POST' });
    } catch {
      // Even if the request fails, clear the local session.
    }
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    await authFetch('/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, setError, login, register, logout, changePassword }),
    [user, loading, error, login, register, logout, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider.');
  return ctx;
}
