// Base URL for the API.
// - In dev with no VITE_API_URL set, use the Vite proxy (relative /api).
// - In production, set VITE_API_URL to the deployed backend URL.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function apiFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
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

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  // 503 is a valid, honest answer when the DB is disconnected — parse it too.
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('Health endpoint returned an unreadable response.');
  return { httpStatus: res.status, ...data };
}

function query(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const coursesApi = {
  list: (params) => apiFetch(`/courses${query(params)}`),
  get: (id) => apiFetch(`/courses/${id}`),
  create: (body) => apiFetch('/courses', { method: 'POST', body }),
  update: (id, body) => apiFetch(`/courses/${id}`, { method: 'PUT', body }),
  remove: (id) => apiFetch(`/courses/${id}`, { method: 'DELETE' }),
};

export const notesApi = {
  list: (params) => apiFetch(`/notes${query(params)}`),
  get: (id) => apiFetch(`/notes/${id}`),
  create: (body) => apiFetch('/notes', { method: 'POST', body }),
  update: (id, body) => apiFetch(`/notes/${id}`, { method: 'PUT', body }),
  remove: (id) => apiFetch(`/notes/${id}`, { method: 'DELETE' }),
};

export const tasksApi = {
  list: (params) => apiFetch(`/tasks${query(params)}`),
  get: (id) => apiFetch(`/tasks/${id}`),
  create: (body) => apiFetch('/tasks', { method: 'POST', body }),
  update: (id, body) => apiFetch(`/tasks/${id}`, { method: 'PUT', body }),
  remove: (id) => apiFetch(`/tasks/${id}`, { method: 'DELETE' }),
};

export const dashboardApi = {
  get: () => apiFetch('/dashboard'),
};
