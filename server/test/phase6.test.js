import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';

// Phase 6 tests: the two small server behaviour fixes from the polish & QA
// pass — course-delete link cleanup and invalid task date filters.
// Everything else in Phase 6 is client/docs QA, verified by the browser
// walkthrough and the manual checklist (docs/test-checklist.md).
let mongo;
let base;
let server;

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = createApp();
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  cookieA = await register('phase6a@studymind.local');
  cookieB = await register('phase6b@studymind.local');
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

async function req(path, { method = 'GET', body, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { res, json, text, cookieOut: res.headers.get('set-cookie') };
}

async function register(email) {
  const { res, cookieOut } = await req('/api/v1/auth/register', {
    method: 'POST',
    body: { name: 'Phase6 User', email, password: 'password123' },
  });
  assert.equal(res.status, 201, `register ${email} should succeed`);
  return cookieOut.split(';')[0];
}

let cookieA;
let cookieB;

test('deleting a course clears its link on notes, tasks, quizzes, decks and GPA records — without deleting them', async () => {
  const course = await req('/api/v1/courses', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Databases', semester: 'Fall 2026', creditHours: 3 },
  });
  assert.equal(course.res.status, 201);
  const courseId = course.json.course._id;

  const note = await req('/api/v1/notes', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Ch1 notes', courseId },
  });
  assert.equal(note.res.status, 201);

  const task = await req('/api/v1/tasks', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Read ch1', courseId, dueDate: '2026-12-01T12:00:00.000Z' },
  });
  assert.equal(task.res.status, 201);

  const quiz = await req('/api/v1/quizzes', {
    method: 'POST',
    cookie: cookieA,
    body: {
      title: 'DB quiz',
      courseId,
      questions: [
        { question: 'Q?', options: ['A', 'B'], correctIndex: 0 },
      ],
    },
  });
  assert.equal(quiz.res.status, 201, JSON.stringify(quiz.json));

  const deck = await req('/api/v1/flashcard-decks', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'DB terms', courseId },
  });
  assert.equal(deck.res.status, 201);

  const record = await req('/api/v1/gpa-records', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Databases', semester: 'Fall 2026', grade: 'A', courseId },
  });
  assert.equal(record.res.status, 201);

  const del = await req(`/api/v1/courses/${courseId}`, { method: 'DELETE', cookie: cookieA });
  assert.equal(del.res.status, 200);

  // Every linked item still exists, with courseId cleared to null.
  const noteAfter = await req(`/api/v1/notes/${note.json.note._id}`, { cookie: cookieA });
  assert.equal(noteAfter.res.status, 200);
  assert.equal(noteAfter.json.note.courseId, null);

  const taskAfter = await req(`/api/v1/tasks/${task.json.task._id}`, { cookie: cookieA });
  assert.equal(taskAfter.res.status, 200);
  assert.equal(taskAfter.json.task.courseId, null);

  const quizAfter = await req(`/api/v1/quizzes/${quiz.json.quiz._id}`, { cookie: cookieA });
  assert.equal(quizAfter.res.status, 200);
  assert.equal(quizAfter.json.quiz.courseId, null);

  const deckAfter = await req(`/api/v1/flashcard-decks/${deck.json.deck._id}`, { cookie: cookieA });
  assert.equal(deckAfter.res.status, 200);
  assert.equal(deckAfter.json.deck.courseId, null);

  const recordAfter = await req(`/api/v1/gpa-records/${record.json.record._id}`, { cookie: cookieA });
  assert.equal(recordAfter.res.status, 200);
  assert.equal(recordAfter.json.record.courseId, null);
});

test('deleting another user\u2019s course is still 404 and does not touch their links', async () => {
  const course = await req('/api/v1/courses', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Mine', semester: 'Fall 2026' },
  });
  assert.equal(course.res.status, 201);
  const other = await req(`/api/v1/courses/${course.json.course._id}`, {
    method: 'DELETE',
    cookie: cookieB,
  });
  assert.equal(other.res.status, 404);
  const mine = await req(`/api/v1/courses/${course.json.course._id}`, { cookie: cookieA });
  assert.equal(mine.res.status, 200);
});

test('invalid task date filters are 400, valid ones still work', async () => {
  const badBefore = await req('/api/v1/tasks?dueBefore=not-a-date', { cookie: cookieA });
  assert.equal(badBefore.res.status, 400);
  assert.match(badBefore.json.error, /dueBefore/);

  const badAfter = await req('/api/v1/tasks?dueAfter=2026-13-45', { cookie: cookieA });
  assert.equal(badAfter.res.status, 400);
  assert.match(badAfter.json.error, /dueAfter/);

  const ok = await req('/api/v1/tasks?dueAfter=2026-01-01', { cookie: cookieA });
  assert.equal(ok.res.status, 200);
  assert.ok(Array.isArray(ok.json.tasks));
});
