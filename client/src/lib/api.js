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

export const quizzesApi = {
  list: (params) => apiFetch(`/quizzes${query(params)}`),
  get: (id) => apiFetch(`/quizzes/${id}`),
  create: (body) => apiFetch('/quizzes', { method: 'POST', body }),
  update: (id, body) => apiFetch(`/quizzes/${id}`, { method: 'PUT', body }),
  remove: (id) => apiFetch(`/quizzes/${id}`, { method: 'DELETE' }),
  stats: (params) => apiFetch(`/quizzes/stats${query(params)}`),
  submitAttempt: (id, body) => apiFetch(`/quizzes/${id}/attempts`, { method: 'POST', body }),
  attempts: (id, params) => apiFetch(`/quizzes/${id}/attempts${query(params)}`),
};

export const flashcardDecksApi = {
  list: (params) => apiFetch(`/flashcard-decks${query(params)}`),
  get: (id) => apiFetch(`/flashcard-decks/${id}`),
  create: (body) => apiFetch('/flashcard-decks', { method: 'POST', body }),
  update: (id, body) => apiFetch(`/flashcard-decks/${id}`, { method: 'PUT', body }),
  remove: (id) => apiFetch(`/flashcard-decks/${id}`, { method: 'DELETE' }),
  cards: (id, params) => apiFetch(`/flashcard-decks/${id}/cards${query(params)}`),
  addCard: (id, body) => apiFetch(`/flashcard-decks/${id}/cards`, { method: 'POST', body }),
  updateCard: (id, cardId, body) =>
    apiFetch(`/flashcard-decks/${id}/cards/${cardId}`, { method: 'PUT', body }),
  removeCard: (id, cardId) => apiFetch(`/flashcard-decks/${id}/cards/${cardId}`, { method: 'DELETE' }),
  due: (id, params) => apiFetch(`/flashcard-decks/${id}/due${query(params)}`),
  review: (id, cardId, body) =>
    apiFetch(`/flashcard-decks/${id}/cards/${cardId}/review`, { method: 'POST', body }),
};

export const studySessionsApi = {
  list: (params) => apiFetch(`/study-sessions${query(params)}`),
  start: (body) => apiFetch('/study-sessions', { method: 'POST', body }),
  complete: (id, body) => apiFetch(`/study-sessions/${id}/complete`, { method: 'POST', body }),
  abandon: (id) => apiFetch(`/study-sessions/${id}/abandon`, { method: 'POST', body: {} }),
  summary: () => apiFetch('/study-sessions/summary'),
};

export const gpaApi = {
  list: (params) => apiFetch(`/gpa-records${query(params)}`),
  get: (id) => apiFetch(`/gpa-records/${id}`),
  create: (body) => apiFetch('/gpa-records', { method: 'POST', body }),
  update: (id, body) => apiFetch(`/gpa-records/${id}`, { method: 'PUT', body }),
  remove: (id) => apiFetch(`/gpa-records/${id}`, { method: 'DELETE' }),
  compute: () => apiFetch('/gpa-records/compute'),
};

export const analyticsApi = {
  overview: (params) => apiFetch(`/analytics/overview${query(params)}`),
};

export const settingsApi = {
  update: (body) => apiFetch('/settings', { method: 'PATCH', body }),
  deleteAccount: (body) => apiFetch('/settings/account', { method: 'DELETE', body }),
};

// Export downloads a file, not JSON — fetch the blob and trigger a download.
export async function downloadExport(format) {
  const res = await fetch(`${API_BASE}/api/v1/settings/export?format=${format}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Export failed (HTTP ${res.status}).`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `studymind-export-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const adminApi = {
  stats: () => apiFetch('/admin/stats'),
  listSubjects: (params) => apiFetch(`/admin/subjects${query(params)}`),
  createSubject: (body) => apiFetch('/admin/subjects', { method: 'POST', body }),
  updateSubject: (id, body) => apiFetch(`/admin/subjects/${id}`, { method: 'PUT', body }),
  removeSubject: (id) => apiFetch(`/admin/subjects/${id}`, { method: 'DELETE' }),
  listSamples: (params) => apiFetch(`/admin/sample-quizzes${query(params)}`),
  getSample: (id) => apiFetch(`/admin/sample-quizzes/${id}`),
  createSample: (body) => apiFetch('/admin/sample-quizzes', { method: 'POST', body }),
  updateSample: (id, body) => apiFetch(`/admin/sample-quizzes/${id}`, { method: 'PUT', body }),
  removeSample: (id) => apiFetch(`/admin/sample-quizzes/${id}`, { method: 'DELETE' }),
  copySample: (id) => apiFetch(`/admin/sample-quizzes/${id}/copy`, { method: 'POST', body: {} }),
};
