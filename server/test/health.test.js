import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

// Health endpoint must NOT crash when MongoDB is down (no MONGODB_URI set
// in tests, so the DB is disconnected). It must answer with a JSON shape
// { status, db, timestamp } and HTTP 503 + db: "disconnected".
test('GET /api/health with DB disconnected returns 503 with JSON shape, not a crash', async () => {
  const app = createApp();
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.db, 'disconnected');
    assert.equal(typeof body.status, 'string');
    assert.equal(typeof body.timestamp, 'string');
    assert.ok(!('secret' in body) && !('uri' in body));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET /api/v1/health mirrors /api/health', async () => {
  const app = createApp();
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.db, 'disconnected');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET / returns plain text that the API is running', async () => {
  const app = createApp();
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /StudyMind API running/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// Auth is real in Phase 2 (see test/auth.test.js). Without a DB, login
// fails honestly with 503 — it must never return a fake success.
test('POST /api/v1/auth/login without a DB returns 503, not a fake success', async () => {
  const app = createApp();
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.local', password: 'password123' }),
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.match(body.error, /Database unavailable/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
