import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';

// Phase 5 tests run against a real MongoDB (mongodb-memory-server).
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
  cookieA = await register('phase5a@studymind.local');
  cookieB = await register('phase5b@studymind.local');
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
    body: { name: 'Phase5 User', email, password: 'password123' },
  });
  assert.equal(res.status, 201, `register ${email} should succeed`);
  return cookieOut.split(';')[0];
}

let cookieA;
let cookieB;
let cookieC;
let courseA;
let recordA;
let recordB;

const TWO_QUESTIONS = [
  {
    question: 'What does CPU stand for?',
    options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility'],
    correctIndex: 0,
    explanation: 'CPU = Central Processing Unit.',
  },
  {
    question: 'Which data structure is FIFO?',
    options: ['Stack', 'Queue', 'Tree'],
    correctIndex: 1,
    explanation: 'A queue is first-in, first-out.',
  },
];

test('unauthenticated Phase 5 routes return 401', async () => {
  for (const path of [
    '/api/v1/gpa-records',
    '/api/v1/analytics/overview',
    '/api/v1/settings/export',
    '/api/v1/admin/stats',
  ]) {
    const { res } = await req(path);
    assert.equal(res.status, 401, `${path} should be 401`);
  }
  const noCookiePost = await req('/api/v1/admin/subjects', {
    method: 'POST',
    body: { title: 'Nope' },
  });
  assert.equal(noCookiePost.res.status, 401);
  const noCookiePatch = await req('/api/v1/settings', {
    method: 'PATCH',
    body: { theme: 'dark' },
  });
  assert.equal(noCookiePatch.res.status, 401);
});

// ---- GPA records + compute ----

test('GPA record linked to a course copies its credit hours; compute is exact', async () => {
  const course = await req('/api/v1/courses', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Mathematics', semester: 'Fall 2026', creditHours: 3 },
  });
  assert.equal(course.res.status, 201);
  courseA = course.json.course;

  const linked = await req('/api/v1/gpa-records', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Mathematics', semester: 'Fall 2026', grade: 'A', courseId: courseA._id },
  });
  assert.equal(linked.res.status, 201, JSON.stringify(linked.json));
  assert.equal(linked.json.record.creditHours, 3, 'credits copied from the course');
  recordA = linked.json.record;

  const manual = await req('/api/v1/gpa-records', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'English', semester: 'Fall 2026', grade: 'B', creditHours: 3 },
  });
  assert.equal(manual.res.status, 201);
  recordB = manual.json.record;

  // A (4.0 x 3cr) + B (3.0 x 3cr) = 21 / 6 = 3.5
  const { res, json } = await req('/api/v1/gpa-records/compute', { cookie: cookieA });
  assert.equal(res.status, 200);
  assert.equal(json.gpa, 3.5);
  assert.equal(json.totalCredits, 6);
  assert.equal(json.estimate, true, 'GPA is labelled an estimate');
  assert.equal(json.bySemester.length, 1);
  assert.equal(json.bySemester[0].semester, 'Fall 2026');
  assert.equal(json.bySemester[0].gpa, 3.5);
});

test('GPA compute honours a custom grading scale, then restores the 4.0 scale', async () => {
  const spring = await req('/api/v1/gpa-records', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'History', semester: 'Spring 2026', grade: 'C', creditHours: 3 },
  });
  assert.equal(spring.res.status, 201);

  const custom = await req('/api/v1/settings', {
    method: 'PATCH',
    cookie: cookieA,
    body: { gradingScale: { A: 5 } },
  });
  assert.equal(custom.res.status, 200);
  assert.equal(custom.json.user.gradingScale.A, 5);
  assert.equal(custom.json.user.gradingScale.B, 3.0, 'other grades are untouched');

  // A (5.0 x 3) + B (3.0 x 3) + C (2.0 x 3) = 30 / 9 = 3.33
  const computed = await req('/api/v1/gpa-records/compute', { cookie: cookieA });
  assert.equal(computed.json.gpa, 3.33);
  assert.equal(computed.json.bySemester.length, 2);

  const restore = await req('/api/v1/settings', {
    method: 'PATCH',
    cookie: cookieA,
    body: { gradingScale: { A: 4.0 } },
  });
  assert.equal(restore.res.status, 200);
  const back = await req('/api/v1/gpa-records/compute', { cookie: cookieA });
  assert.equal(back.json.gpa, 3.0, '(12 + 9 + 6) / 9 = 3.0 on the 4.0 scale');
});

test('GPA validation rejects bad grades, missing credits and other-user courses', async () => {
  const badGrade = await req('/api/v1/gpa-records', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Bad', grade: 'E', creditHours: 3 },
  });
  assert.equal(badGrade.res.status, 400);

  const noCredits = await req('/api/v1/gpa-records', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'NoCredits', grade: 'A' },
  });
  assert.equal(noCredits.res.status, 400);

  const otherCourse = await req('/api/v1/gpa-records', {
    method: 'POST',
    cookie: cookieB,
    body: { title: 'Stolen', grade: 'A', courseId: courseA._id },
  });
  assert.equal(otherCourse.res.status, 400, 'another user courseId is rejected');

  const otherRecord = await req(`/api/v1/gpa-records/${recordA._id}`, { cookie: cookieB });
  assert.equal(otherRecord.res.status, 404, 'another user record is invisible');
  const otherUpdate = await req(`/api/v1/gpa-records/${recordA._id}`, {
    method: 'PUT',
    cookie: cookieB,
    body: { grade: 'F' },
  });
  assert.equal(otherUpdate.res.status, 404);
  const otherDelete = await req(`/api/v1/gpa-records/${recordA._id}`, {
    method: 'DELETE',
    cookie: cookieB,
  });
  assert.equal(otherDelete.res.status, 404);

  const ownDelete = await req(`/api/v1/gpa-records/${recordB._id}`, {
    method: 'DELETE',
    cookie: cookieA,
  });
  assert.equal(ownDelete.res.status, 200);
  const after = await req('/api/v1/gpa-records/compute', { cookie: cookieA });
  // A (4.0 x 3) + C (2.0 x 3) = 18 / 6 = 3.0 after deleting the B record.
  assert.equal(after.json.gpa, 3.0);
  assert.equal(after.json.totalCredits, 6);
});

// ---- Analytics ----

test('analytics overview numbers match seeded sessions, tasks and quiz attempts', async () => {
  // One completed focus session (25 min).
  const started = await req('/api/v1/study-sessions', {
    method: 'POST',
    cookie: cookieA,
    body: { type: 'focus', plannedMinutes: 25, clientKey: 'phase5-analytics-a' },
  });
  assert.equal(started.res.status, 201);
  const done = await req(`/api/v1/study-sessions/${started.json.session._id}/complete`, {
    method: 'POST',
    cookie: cookieA,
    body: { actualMinutes: 25 },
  });
  assert.equal(done.res.status, 200);

  // One completed task.
  const task = await req('/api/v1/tasks', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Analytics task', courseId: courseA._id },
  });
  assert.equal(task.res.status, 201);
  const completed = await req(`/api/v1/tasks/${task.json.task._id}`, {
    method: 'PUT',
    cookie: cookieA,
    body: { completed: true },
  });
  assert.equal(completed.res.status, 200);

  // One quiz attempt, 1 right / 1 wrong = 50%.
  const quiz = await req('/api/v1/quizzes', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Analytics Quiz', courseId: courseA._id, questions: TWO_QUESTIONS },
  });
  assert.equal(quiz.res.status, 201);
  const attempt = await req(`/api/v1/quizzes/${quiz.json.quiz._id}/attempts`, {
    method: 'POST',
    cookie: cookieA,
    body: { answers: [0, 0] },
  });
  assert.equal(attempt.res.status, 201);
  assert.equal(attempt.json.attempt.percentage, 50);

  const { res, json } = await req('/api/v1/analytics/overview', { cookie: cookieA });
  assert.equal(res.status, 200);
  assert.equal(json.totals.totalFocusMinutes, 25);
  assert.equal(json.totals.completedFocusSessions, 1);
  assert.equal(json.totals.tasksCompleted, 1);
  assert.equal(json.totals.totalQuizAttempts, 1);
  assert.equal(json.totals.averageQuizPercentage, 50);
  assert.equal(json.totals.bestQuizPercentage, 50);
  assert.equal(json.daily.length, 30, 'default range is 30 days');
  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = json.daily.find((d) => d.date === today);
  assert.ok(todayEntry, 'today is in the daily series');
  assert.equal(todayEntry.focusMinutes, 25);
  assert.equal(todayEntry.tasksCompleted, 1);
  assert.equal(todayEntry.quizAttempts, 1);
  assert.equal(todayEntry.averageQuizPercentage, 50);
  const courseRow = json.byCourse.find((c) => String(c.courseId) === String(courseA._id));
  assert.ok(courseRow, 'course breakdown includes the course');
  assert.equal(courseRow.tasksCompleted, 1);
  assert.equal(courseRow.quizAttempts, 1);
  assert.equal(courseRow.averageQuizPercentage, 50);
});

test('analytics date filters exclude out-of-range data and reject bad ranges', async () => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const { res, json } = await req(
    `/api/v1/analytics/overview?from=${tomorrow}&to=${tomorrow}`,
    { cookie: cookieA },
  );
  assert.equal(res.status, 200);
  assert.equal(json.totals.totalFocusMinutes, 0);
  assert.equal(json.totals.tasksCompleted, 0);
  assert.equal(json.totals.totalQuizAttempts, 0);
  assert.equal(json.daily.length, 1);

  const reversed = await req('/api/v1/analytics/overview?from=2026-11-10&to=2026-11-01', {
    cookie: cookieA,
  });
  assert.equal(reversed.res.status, 400);
  const badDate = await req('/api/v1/analytics/overview?from=not-a-date', { cookie: cookieA });
  assert.equal(badDate.res.status, 400);
  const tooWide = await req('/api/v1/analytics/overview?from=2020-01-01&to=2026-11-01', {
    cookie: cookieA,
  });
  assert.equal(tooWide.res.status, 400);
});

// ---- Settings: theme, timezone, scale validation ----

test('settings update validates theme, timezone and scale values', async () => {
  const ok = await req('/api/v1/settings', {
    method: 'PATCH',
    cookie: cookieA,
    body: { theme: 'dark', timezone: 'Asia/Karachi' },
  });
  assert.equal(ok.res.status, 200);
  assert.equal(ok.json.user.theme, 'dark');
  assert.equal(ok.json.user.timezone, 'Asia/Karachi');

  const badTheme = await req('/api/v1/settings', {
    method: 'PATCH',
    cookie: cookieA,
    body: { theme: 'neon' },
  });
  assert.equal(badTheme.res.status, 400);
  const badZone = await req('/api/v1/settings', {
    method: 'PATCH',
    cookie: cookieA,
    body: { timezone: 'Not/AZone' },
  });
  assert.equal(badZone.res.status, 400);
  const badScale = await req('/api/v1/settings', {
    method: 'PATCH',
    cookie: cookieA,
    body: { gradingScale: { A: 9 } },
  });
  assert.equal(badScale.res.status, 400, 'grade points above 5 are rejected');
});

// ---- Export: only the requesting user's data ----

test('export JSON and CSV contain only the requesting user data', async () => {
  const mine = await req('/api/v1/courses', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'ExportCourseA', semester: 'Fall 2026' },
  });
  assert.equal(mine.res.status, 201);
  const theirs = await req('/api/v1/courses', {
    method: 'POST',
    cookie: cookieB,
    body: { title: 'OtherUserCourseB', semester: 'Fall 2026' },
  });
  assert.equal(theirs.res.status, 201);

  const jsonExport = await req('/api/v1/settings/export?format=json', { cookie: cookieA });
  assert.equal(jsonExport.res.status, 200);
  const titles = jsonExport.json.courses.map((c) => c.title);
  assert.ok(titles.includes('ExportCourseA'), 'own course is exported');
  assert.ok(!titles.includes('OtherUserCourseB'), 'other user course is NOT exported');
  assert.equal(jsonExport.json.user.email, 'phase5a@studymind.local');

  const csvExport = await req('/api/v1/settings/export?format=csv', { cookie: cookieA });
  assert.equal(csvExport.res.status, 200);
  assert.ok(csvExport.text.includes('## Courses'), 'CSV has a Courses section');
  assert.ok(csvExport.text.includes('ExportCourseA'), 'CSV contains own course');
  assert.ok(!csvExport.text.includes('OtherUserCourseB'), 'CSV excludes other user data');
});

// ---- Account deletion ----

test('account deletion needs the password and removes owned data', async () => {
  const cookieD = await register('phase5d@studymind.local');
  const course = await req('/api/v1/courses', {
    method: 'POST',
    cookie: cookieD,
    body: { title: 'DoomedCourse', semester: 'Fall 2026' },
  });
  assert.equal(course.res.status, 201);
  const courseId = course.json.course._id;

  const wrong = await req('/api/v1/settings/account', {
    method: 'DELETE',
    cookie: cookieD,
    body: { password: 'wrong-password' },
  });
  assert.equal(wrong.res.status, 401);

  const gone = await req('/api/v1/settings/account', {
    method: 'DELETE',
    cookie: cookieD,
    body: { password: 'password123' },
  });
  assert.equal(gone.res.status, 200);
  assert.equal(gone.json.ok, true);

  const me = await req('/api/v1/auth/me', { cookie: cookieD });
  assert.equal(me.res.status, 401, 'old token stops working after deletion');
  const courseCheck = await req(`/api/v1/courses/${courseId}`, { cookie: cookieA });
  assert.equal(courseCheck.res.status, 404, 'owned course is gone');
});

// ---- Admin: role gating, subjects, sample quizzes, stats ----

test('non-admin cannot use admin endpoints; admin can manage subjects', async () => {
  const forbidden = await req('/api/v1/admin/subjects', {
    method: 'POST',
    cookie: cookieB,
    body: { title: 'Hacker Subject' },
  });
  assert.equal(forbidden.res.status, 403);
  const statsForbidden = await req('/api/v1/admin/stats', { cookie: cookieB });
  assert.equal(statsForbidden.res.status, 403);

  // Promote user C to admin directly in the DB (the promote-admin script
  // does the same thing from the command line; verified in the live flow).
  cookieC = await register('phase5c@studymind.local');
  await User.updateOne({ email: 'phase5c@studymind.local' }, { role: 'admin' });

  const created = await req('/api/v1/admin/subjects', {
    method: 'POST',
    cookie: cookieC,
    body: { title: 'Data Structures', code: 'CS-201', category: 'Computer Science' },
  });
  assert.equal(created.res.status, 201);
  const subjectId = created.json.subject._id;

  // Students can browse curated subjects but cannot write them.
  const browse = await req('/api/v1/admin/subjects', { cookie: cookieB });
  assert.equal(browse.res.status, 200);
  assert.ok(browse.json.subjects.some((s) => s.title === 'Data Structures'));

  const updated = await req(`/api/v1/admin/subjects/${subjectId}`, {
    method: 'PUT',
    cookie: cookieC,
    body: { description: 'Arrays, trees and graphs.' },
  });
  assert.equal(updated.res.status, 200);
  assert.equal(updated.json.subject.description, 'Arrays, trees and graphs.');

  const deleted = await req(`/api/v1/admin/subjects/${subjectId}`, {
    method: 'DELETE',
    cookie: cookieC,
  });
  assert.equal(deleted.res.status, 200);
  const gone = await req(`/api/v1/admin/subjects/${subjectId}`, { cookie: cookieC });
  assert.equal(gone.res.status, 404);
});

test('admin sample quizzes: browse hides answers, students copy, admin edits', async () => {
  const created = await req('/api/v1/admin/sample-quizzes', {
    method: 'POST',
    cookie: cookieC,
    body: { title: 'Sample: CS Basics', description: 'Try it.', questions: TWO_QUESTIONS },
  });
  assert.equal(created.res.status, 201, JSON.stringify(created.json));
  assert.equal(created.json.quiz.isSample, true);
  const sampleId = created.json.quiz._id;

  const browse = await req('/api/v1/admin/sample-quizzes', { cookie: cookieB });
  assert.equal(browse.res.status, 200);
  const listed = browse.json.quizzes.find((q) => String(q._id) === String(sampleId));
  assert.ok(listed, 'sample is listed for students');
  assert.equal('correctIndex' in listed.questions[0], false, 'answers are hidden when browsing');

  const detail = await req(`/api/v1/admin/sample-quizzes/${sampleId}`, { cookie: cookieB });
  assert.equal(detail.res.status, 200);
  assert.equal('correctIndex' in detail.json.quiz.questions[0], false);

  // A student cannot edit a sample, but can copy it into their own quizzes.
  const editForbidden = await req(`/api/v1/admin/sample-quizzes/${sampleId}`, {
    method: 'PUT',
    cookie: cookieB,
    body: { title: 'Hacked' },
  });
  assert.equal(editForbidden.res.status, 403);

  const copy = await req(`/api/v1/admin/sample-quizzes/${sampleId}/copy`, {
    method: 'POST',
    cookie: cookieB,
    body: {},
  });
  assert.equal(copy.res.status, 201);
  assert.equal(copy.json.quiz.isSample, false);
  assert.equal(copy.json.quiz.title, 'Sample: CS Basics');
  assert.equal(copy.json.quiz.questions.length, 2);
  const own = await req(`/api/v1/quizzes/${copy.json.quiz._id}`, { cookie: cookieB });
  assert.equal(own.res.status, 200);

  const adminEdit = await req(`/api/v1/admin/sample-quizzes/${sampleId}`, {
    method: 'PUT',
    cookie: cookieC,
    body: { description: 'Updated by admin.' },
  });
  assert.equal(adminEdit.res.status, 200);
  const adminDelete = await req(`/api/v1/admin/sample-quizzes/${sampleId}`, {
    method: 'DELETE',
    cookie: cookieC,
  });
  assert.equal(adminDelete.res.status, 200);
  const gone = await req(`/api/v1/admin/sample-quizzes/${sampleId}`, { cookie: cookieB });
  assert.equal(gone.res.status, 404);
});

test('admin stats return counts only, never private content', async () => {
  const { res, json } = await req('/api/v1/admin/stats', { cookie: cookieC });
  assert.equal(res.status, 200);
  assert.equal(json.users, 3, 'A, B, C — D deleted their account');
  assert.ok(typeof json.courses === 'number' && json.courses >= 1);
  assert.ok(typeof json.quizAttempts === 'number' && json.quizAttempts >= 1);
  assert.ok(typeof json.studySessions === 'number' && json.studySessions >= 1);
  assert.ok(!('notes' in json) || typeof json.notes === 'number');
  assert.equal(JSON.stringify(json).includes('ExportCourseA'), false, 'no titles leak in stats');
});
