import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';

// Phase 3 tests run against a real MongoDB (mongodb-memory-server).
// No Atlas / production DB is used.
let mongo;
let base;
let server;

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = createApp();
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  // User registration lives in the SAME before hook as server startup:
  // node:test may run multiple before hooks concurrently, so a second
  // hook cannot rely on `base` being set yet.
  cookieA = await register('phase3a@studymind.local');
  cookieB = await register('phase3b@studymind.local');
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
  return { res, json, cookieOut: res.headers.get('set-cookie') };
}

async function register(email) {
  const { res, cookieOut } = await req('/api/v1/auth/register', {
    method: 'POST',
    body: { name: 'Phase3 User', email, password: 'password123' },
  });
  assert.equal(res.status, 201, `register ${email} should succeed`);
  return cookieOut.split(';')[0];
}

let cookieA;
let cookieB;
let courseA;
let noteA;
let taskA;

test('unauthenticated course list returns 401', async () => {
  const { res } = await req('/api/v1/courses');
  assert.equal(res.status, 401);
});

// ---- Courses ----

test('create course returns 201 with defaults', async () => {
  const { res, json } = await req('/api/v1/courses', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Database Systems', code: 'CS301', semester: 'Fall 2026', creditHours: 3 },
  });
  assert.equal(res.status, 201);
  assert.equal(json.course.title, 'Database Systems');
  assert.equal(json.course.colour, '#4F46E5');
  assert.equal(json.course.archived, false);
  courseA = json.course;
});

test('course validation rejects empty title and bad colour', async () => {
  const empty = await req('/api/v1/courses', {
    method: 'POST',
    cookie: cookieA,
    body: { title: '', semester: 'Fall 2026' },
  });
  assert.equal(empty.res.status, 400);
  const badColour = await req('/api/v1/courses', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'X', semester: 'Fall 2026', colour: 'red' },
  });
  assert.equal(badColour.res.status, 400);
});

test('course list, search, semester filter and update work', async () => {
  const list = await req('/api/v1/courses', { cookie: cookieA });
  assert.equal(list.res.status, 200);
  assert.equal(list.json.total, 1);
  assert.equal(list.json.courses[0].title, 'Database Systems');

  const search = await req('/api/v1/courses?search=database', { cookie: cookieA });
  assert.equal(search.json.total, 1);
  const miss = await req('/api/v1/courses?search=zzzznothing', { cookie: cookieA });
  assert.equal(miss.json.total, 0);
  const sem = await req('/api/v1/courses?semester=Spring%202026', { cookie: cookieA });
  assert.equal(sem.json.total, 0);

  const updated = await req(`/api/v1/courses/${courseA._id}`, {
    method: 'PUT',
    cookie: cookieA,
    body: { title: 'Advanced Database Systems' },
  });
  assert.equal(updated.res.status, 200);
  assert.equal(updated.json.course.title, 'Advanced Database Systems');
  courseA = updated.json.course;
});

// ---- Notes ----

test('create note with course, search, tag and pinned filters work', async () => {
  const { res, json } = await req('/api/v1/notes', {
    method: 'POST',
    cookie: cookieA,
    body: {
      title: 'Normalization notes',
      courseId: courseA._id,
      contentMarkdown: '# Normalization\nThird normal form removes transitive deps.',
      tags: ['db', 'exam'],
      pinned: true,
    },
  });
  assert.equal(res.status, 201);
  assert.equal(json.note.courseId, courseA._id);
  assert.deepEqual(json.note.tags, ['db', 'exam']);
  noteA = json.note;

  const search = await req('/api/v1/notes?search=transitive', { cookie: cookieA });
  assert.equal(search.json.total, 1);
  const tag = await req('/api/v1/notes?tag=exam', { cookie: cookieA });
  assert.equal(tag.json.total, 1);
  const tagMiss = await req('/api/v1/notes?tag=other', { cookie: cookieA });
  assert.equal(tagMiss.json.total, 0);
  const pinned = await req('/api/v1/notes?pinned=true', { cookie: cookieA });
  assert.equal(pinned.json.total, 1);
});

test('note PUT is the autosave endpoint and returns the new title', async () => {
  const { res, json } = await req(`/api/v1/notes/${noteA._id}`, {
    method: 'PUT',
    cookie: cookieA,
    body: { title: 'Normalization notes (updated)', contentMarkdown: 'Updated content.' },
  });
  assert.equal(res.status, 200);
  assert.equal(json.note.title, 'Normalization notes (updated)');
  assert.ok(json.note.updatedAt);
  noteA = json.note;
});

test("note with another user's courseId returns 400", async () => {
  const other = await req('/api/v1/courses', {
    method: 'POST',
    cookie: cookieB,
    body: { title: 'Biology', semester: 'Fall 2026' },
  });
  assert.equal(other.res.status, 201);
  const bad = await req('/api/v1/notes', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Sneaky note', courseId: other.json.course._id },
  });
  assert.equal(bad.res.status, 400);
});

// ---- Tasks ----

test('create task, complete toggle stamps and clears completedAt', async () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { res, json } = await req('/api/v1/tasks', {
    method: 'POST',
    cookie: cookieA,
    body: {
      title: 'Read chapter 4',
      courseId: courseA._id,
      dueDate: tomorrow,
      priority: 'high',
    },
  });
  assert.equal(res.status, 201);
  assert.equal(json.task.completed, false);
  assert.equal(json.task.completedAt, null);
  taskA = json.task;

  const done = await req(`/api/v1/tasks/${taskA._id}`, {
    method: 'PUT',
    cookie: cookieA,
    body: { completed: true },
  });
  assert.equal(done.res.status, 200);
  assert.equal(done.json.task.completed, true);
  assert.ok(done.json.task.completedAt);

  const undone = await req(`/api/v1/tasks/${taskA._id}`, {
    method: 'PUT',
    cookie: cookieA,
    body: { completed: false },
  });
  assert.equal(undone.res.status, 200);
  assert.equal(undone.json.task.completed, false);
  assert.equal(undone.json.task.completedAt, null);
  taskA = undone.json.task;
});

test('task validation rejects empty title and bad priority', async () => {
  const empty = await req('/api/v1/tasks', {
    method: 'POST',
    cookie: cookieA,
    body: { title: '' },
  });
  assert.equal(empty.res.status, 400);
  const badPriority = await req('/api/v1/tasks', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'X', priority: 'urgent' },
  });
  assert.equal(badPriority.res.status, 400);
});

test('overdue filter returns only tasks due before now', async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const created = await req('/api/v1/tasks', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Overdue assignment', dueDate: yesterday },
  });
  assert.equal(created.res.status, 201);

  const overdue = await req(`/api/v1/tasks?dueBefore=${new Date().toISOString()}`, {
    cookie: cookieA,
  });
  assert.equal(overdue.res.status, 200);
  assert.ok(overdue.json.tasks.some((t) => t.title === 'Overdue assignment'));
  assert.ok(overdue.json.tasks.every((t) => new Date(t.dueDate) < new Date()));
});

// ---- Ownership ----

test("user B cannot read, update or delete user A's course, note or task", async () => {
  for (const [path, id] of [
    ['courses', courseA._id],
    ['notes', noteA._id],
    ['tasks', taskA._id],
  ]) {
    const get = await req(`/api/v1/${path}/${id}`, { cookie: cookieB });
    assert.equal(get.res.status, 404, `B GET ${path} should be 404`);
    const put = await req(`/api/v1/${path}/${id}`, {
      method: 'PUT',
      cookie: cookieB,
      body: { title: 'Hijacked' },
    });
    assert.equal(put.res.status, 404, `B PUT ${path} should be 404`);
    const del = await req(`/api/v1/${path}/${id}`, { method: 'DELETE', cookie: cookieB });
    assert.equal(del.res.status, 404, `B DELETE ${path} should be 404`);
  }
  // A's data is untouched by B's attempts.
  const mine = await req(`/api/v1/courses/${courseA._id}`, { cookie: cookieA });
  assert.equal(mine.res.status, 200);
  assert.equal(mine.json.course.title, 'Advanced Database Systems');
});

// ---- Dashboard ----

test('dashboard metrics match the data actually stored', async () => {
  const courses = await req('/api/v1/courses?limit=100', { cookie: cookieA });
  const tasks = await req('/api/v1/tasks?limit=100', { cookie: cookieA });
  const { res, json } = await req('/api/v1/dashboard', { cookie: cookieA });
  assert.equal(res.status, 200);

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const in7Days = new Date(startOfToday);
  in7Days.setDate(in7Days.getDate() + 7);

  const incomplete = tasks.json.tasks.filter((t) => !t.completed);
  const expected = {
    totalCourses: courses.json.total,
    totalTasks: tasks.json.total,
    completedTasks: tasks.json.tasks.filter((t) => t.completed).length,
    overdueTasks: incomplete.filter((t) => t.dueDate && new Date(t.dueDate) < now).length,
    dueTodayTasks: incomplete.filter(
      (t) => t.dueDate && new Date(t.dueDate) >= startOfToday && new Date(t.dueDate) < startOfTomorrow,
    ).length,
    dueNext7Days: incomplete.filter(
      (t) => t.dueDate && new Date(t.dueDate) >= startOfToday && new Date(t.dueDate) < in7Days,
    ).length,
  };
  assert.equal(json.totalCourses, expected.totalCourses);
  assert.equal(json.totalTasks, expected.totalTasks);
  assert.equal(json.completedTasks, expected.completedTasks);
  assert.equal(json.overdueTasks, expected.overdueTasks);
  assert.equal(json.dueTodayTasks, expected.dueTodayTasks);
  assert.equal(json.dueNext7Days, expected.dueNext7Days);
  assert.ok(json.overdueTasks >= 1, 'the overdue assignment should be counted');
  assert.equal(json.recentNotes.length, 1);
  assert.equal(json.recentNotes[0].title, 'Normalization notes (updated)');
  assert.ok(json.nextTasks.length >= 1);
  assert.ok(json.tasksByCourse.some((c) => c.title === 'Advanced Database Systems'));
  // No invented metrics: no study-time or quiz fields.
  assert.ok(!('studyMinutes' in json) && !('quizScore' in json));
});

test('dashboard requires auth', async () => {
  const { res } = await req('/api/v1/dashboard');
  assert.equal(res.status, 401);
});

// ---- Deletes (last, so earlier tests keep their data) ----

test('owner can delete a note, task and course', async () => {
  const delNote = await req(`/api/v1/notes/${noteA._id}`, { method: 'DELETE', cookie: cookieA });
  assert.equal(delNote.res.status, 200);
  const gone = await req(`/api/v1/notes/${noteA._id}`, { cookie: cookieA });
  assert.equal(gone.res.status, 404);

  const delTask = await req(`/api/v1/tasks/${taskA._id}`, { method: 'DELETE', cookie: cookieA });
  assert.equal(delTask.res.status, 200);

  const delCourse = await req(`/api/v1/courses/${courseA._id}`, {
    method: 'DELETE',
    cookie: cookieA,
  });
  assert.equal(delCourse.res.status, 200);
});
