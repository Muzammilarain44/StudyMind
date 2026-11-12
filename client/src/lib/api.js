// Base URL for the API.
// - In dev with no VITE_API_URL set, use the Vite proxy (relative /api).
// - In production, set VITE_API_URL to the deployed backend URL.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  // 503 is a valid, honest answer when the DB is disconnected — parse it too.
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('Health endpoint returned an unreadable response.');
  return { httpStatus: res.status, ...data };
}
