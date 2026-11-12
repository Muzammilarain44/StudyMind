import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';

// Phase 4 tests run against a real MongoDB (mongodb-memory-server).
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
  cookieA = await register('phase4a@studymind.local');
  cookieB = await register('phase4b@studymind.local');
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
    body: { name: 'Phase4 User', email, password: 'password123' },
  });
  assert.equal(res.status, 201, `register ${email} should succeed`);
  return cookieOut.split(';')[0];
}

let cookieA;
let cookieB;
let courseA;
let quizA;
let deckA;
let card1;
let card2;
let sessionA;

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

test('unauthenticated quizzes, decks and sessions return 401', async () => {
  for (const path of ['/api/v1/quizzes', '/api/v1/flashcard-decks', '/api/v1/study-sessions']) {
    const { res } = await req(path);
    assert.equal(res.status, 401, `${path} should be 401`);
  }
});

// ---- Quizzes ----

test('create quiz with course and timer returns 201', async () => {
  const course = await req('/api/v1/courses', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Computer Science', semester: 'Fall 2026' },
  });
  assert.equal(course.res.status, 201);
  courseA = course.json.course;

  const { res, json } = await req('/api/v1/quizzes', {
    method: 'POST',
    cookie: cookieA,
    body: {
      title: 'CS Basics',
      description: 'First quiz',
      courseId: courseA._id,
      timeLimitSeconds: 600,
      questions: TWO_QUESTIONS,
    },
  });
  assert.equal(res.status, 201);
  assert.equal(json.quiz.title, 'CS Basics');
  assert.equal(json.quiz.timeLimitSeconds, 600);
  assert.equal(json.quiz.questions.length, 2);
  quizA = json.quiz;
});

test('quiz validation rejects bad correctIndex, too few options and no questions', async () => {
  const badIndex = await req('/api/v1/quizzes', {
    method: 'POST',
    cookie: cookieA,
    body: {
      title: 'Bad',
      questions: [{ question: 'Q?', options: ['A', 'B'], correctIndex: 5 }],
    },
  });
  assert.equal(badIndex.res.status, 400);

  const oneOption = await req('/api/v1/quizzes', {
    method: 'POST',
    cookie: cookieA,
    body: {
      title: 'Bad',
      questions: [{ question: 'Q?', options: ['Only'], correctIndex: 0 }],
    },
  });
  assert.equal(oneOption.res.status, 400);

  const noQuestions = await req('/api/v1/quizzes', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'Bad', questions: [] },
  });
  assert.equal(noQuestions.res.status, 400);
});

test('quiz list shows questionCount without questions, and search works', async () => {
  const list = await req('/api/v1/quizzes', { cookie: cookieA });
  assert.equal(list.res.status, 200);
  assert.equal(list.json.total, 1);
  assert.equal(list.json.quizzes[0].questionCount, 2);
  assert.equal(list.json.quizzes[0].questions, undefined);

  const hit = await req('/api/v1/quizzes?search=basics', { cookie: cookieA });
  assert.equal(hit.json.total, 1);
  const miss = await req('/api/v1/quizzes?search=zzzznothing', { cookie: cookieA });
  assert.equal(miss.json.total, 0);
});

test('attempt grades exactly: 1 right 1 wrong scores 1/2 with explanations', async () => {
  const { res, json } = await req(`/api/v1/quizzes/${quizA._id}/attempts`, {
    method: 'POST',
    cookie: cookieA,
    body: { answers: [0, 0], timeTakenSeconds: 120 },
  });
  assert.equal(res.status, 201);
  assert.equal(json.attempt.score, 1);
  assert.equal(json.attempt.total, 2);
  assert.equal(json.attempt.percentage, 50);
  assert.equal(json.attempt.timeTakenSeconds, 120);
  assert.equal(json.results.length, 2);
  assert.equal(json.results[0].correct, true);
  assert.equal(json.results[1].correct, false);
  assert.equal(json.results[1].correctIndex, 1);
  assert.equal(json.results[1].explanation, 'A queue is first-in, first-out.');
});

test('attempt validation rejects wrong length and out-of-range answers', async () => {
  const short = await req(`/api/v1/quizzes/${quizA._id}/attempts`, {
    method: 'POST',
    cookie: cookieA,
    body: { answers: [0] },
  });
  assert.equal(short.res.status, 400);

  const badOption = await req(`/api/v1/quizzes/${quizA._id}/attempts`, {
    method: 'POST',
    cookie: cookieA,
    body: { answers: [0, 9] },
  });
  assert.equal(badOption.res.status, 400);
});

test('attempt history and per-course stats match the attempt', async () => {
  const history = await req(`/api/v1/quizzes/${quizA._id}/attempts`, { cookie: cookieA });
  assert.equal(history.res.status, 200);
  assert.equal(history.json.total, 1);
  assert.equal(history.json.attempts[0].percentage, 50);

  const stats = await req('/api/v1/quizzes/stats', { cookie: cookieA });
  assert.equal(stats.res.status, 200);
  assert.equal(stats.json.totalQuizzes, 1);
  assert.equal(stats.json.totalAttempts, 1);
  assert.equal(stats.json.averagePercentage, 50);
  assert.equal(stats.json.bestPercentage, 50);
  assert.equal(stats.json.byCourse.length, 1);
  assert.equal(stats.json.byCourse[0].courseTitle, 'Computer Science');
  assert.equal(stats.json.byCourse[0].attempts, 1);
  assert.equal(stats.json.byCourse[0].averagePercentage, 50);
});

// ---- Flashcards ----

test('create deck and cards returns 201; card validation rejects empty front', async () => {
  const { res, json } = await req('/api/v1/flashcard-decks', {
    method: 'POST',
    cookie: cookieA,
    body: { title: 'OS Terms', courseId: courseA._id },
  });
  assert.equal(res.status, 201);
  deckA = json.deck;

  const c1 = await req(`/api/v1/flashcard-decks/${deckA._id}/cards`, {
    method: 'POST',
    cookie: cookieA,
    body: { front: 'What is a process?', back: 'A program in execution.' },
  });
  assert.equal(c1.res.status, 201);
  card1 = c1.json.card;

  const c2 = await req(`/api/v1/flashcard-decks/${deckA._id}/cards`, {
    method: 'POST',
    cookie: cookieA,
    body: { front: 'What is a thread?', back: 'A lightweight unit of execution.' },
  });
  assert.equal(c2.res.status, 201);
  card2 = c2.json.card;

  const bad = await req(`/api/v1/flashcard-decks/${deckA._id}/cards`, {
    method: 'POST',
    cookie: cookieA,
    body: { front: '', back: 'No front' },
  });
  assert.equal(bad.res.status, 400);

  const deck = await req(`/api/v1/flashcard-decks/${deckA._id}`, { cookie: cookieA });
  assert.equal(deck.json.deck.cardCount, 2);
});

test('due queue lists new cards; a good review moves nextDue about 3 days out', async () => {
  const dueBefore = await req(`/api/v1/flashcard-decks/${deckA._id}/due`, { cookie: cookieA });
  assert.equal(dueBefore.res.status, 200);
  assert.equal(dueBefore.json.dueCount, 2);

  const before = Date.now();
  const review = await req(`/api/v1/flashcard-decks/${deckA._id}/cards/${card1._id}/review`, {
    method: 'POST',
    cookie: cookieA,
    body: { rating: 'good' },
  });
  assert.equal(review.res.status, 201);
  // SM-2-lite: a new card rated "good" gets a 3-day interval.
  assert.equal(review.json.review.intervalDays, 3);
  const nextDue = new Date(review.json.review.nextDue).getTime();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  assert.ok(nextDue >= before + threeDays - 60_000 && nextDue <= before + threeDays + 60_000);

  // Reviewed card is no longer due; the unreviewed one still is.
  const dueAfter = await req(`/api/v1/flashcard-decks/${deckA._id}/due`, { cookie: cookieA });
  assert.equal(dueAfter.json.dueCount, 1);
  assert.equal(dueAfter.json.cards[0]._id, card2._id);
});

test('a second review grows the interval (easy after good: 3 -> 11 days)', async () => {
  const review = await req(`/api/v1/flashcard-decks/${deckA._id}/cards/${card1._id}/review`, {
    method: 'POST',
    cookie: cookieA,
    body: { rating: 'easy' },
  });
  assert.equal(review.res.status, 201);
  // SM-2-lite: easy = round(3 * 3.5) = 11 days.
  assert.equal(review.json.review.intervalDays, 11);

  const again = await req(`/api/v1/flashcard-decks/${deckA._id}/cards/${card2._id}/review`, {
    method: 'POST',
    cookie: cookieA,
    body: { rating: 'again' },
  });
  assert.equal(again.res.status, 201);
  assert.equal(again.json.review.intervalDays, 1);

  const badRating = await req(`/api/v1/flashcard-decks/${deckA._id}/cards/${card2._id}/review`, {
    method: 'POST',
    cookie: cookieA,
    body: { rating: 'perfect' },
  });
  assert.equal(badRating.res.status, 400);
});

// ---- Pomodoro ----

test('start session returns 201; same clientKey returns the same session, not a duplicate', async () => {
  const key = `test-key-${Date.now()}`;
  const first = await req('/api/v1/study-sessions', {
    method: 'POST',
    cookie: cookieA,
    body: { type: 'focus', plannedMinutes: 25, clientKey: key },
  });
  assert.equal(first.res.status, 201);
  assert.equal(first.json.duplicate, false);
  assert.equal(first.json.session.status, 'active');
  sessionA = first.json.session;

  const retry = await req('/api/v1/study-sessions', {
    method: 'POST',
    cookie: cookieA,
    body: { type: 'focus', plannedMinutes: 25, clientKey: key },
  });
  assert.equal(retry.res.status, 200);
  assert.equal(retry.json.duplicate, true);
  assert.equal(retry.json.session._id, sessionA._id);

  const list = await req('/api/v1/study-sessions?status=active', { cookie: cookieA });
  assert.equal(list.json.total, 1);
});

test('session validation rejects missing clientKey and bad minutes', async () => {
  const noKey = await req('/api/v1/study-sessions', {
    method: 'POST',
    cookie: cookieA,
    body: { type: 'focus', plannedMinutes: 25 },
  });
  assert.equal(noKey.res.status, 400);

  const badMinutes = await req('/api/v1/study-sessions', {
    method: 'POST',
    cookie: cookieA,
    body: { type: 'focus', plannedMinutes: 0, clientKey: 'bad-minutes-key' },
  });
  assert.equal(badMinutes.res.status, 400);
});

test('complete works once; a second complete is 409; abandoned cannot complete', async () => {
  const done = await req(`/api/v1/study-sessions/${sessionA._id}/complete`, {
    method: 'POST',
    cookie: cookieA,
    body: { actualMinutes: 25 },
  });
  assert.equal(done.res.status, 200);
  assert.equal(done.json.session.status, 'completed');
  assert.equal(done.json.session.actualMinutes, 25);
  assert.ok(done.json.session.completedAt);

  const again = await req(`/api/v1/study-sessions/${sessionA._id}/complete`, {
    method: 'POST',
    cookie: cookieA,
    body: {},
  });
  assert.equal(again.res.status, 409);

  const second = await req('/api/v1/study-sessions', {
    method: 'POST',
    cookie: cookieA,
    body: { type: 'break', plannedMinutes: 5, clientKey: `break-key-${Date.now()}` },
  });
  assert.equal(second.res.status, 201);
  const abandoned = await req(`/api/v1/study-sessions/${second.json.session._id}/abandon`, {
    method: 'POST',
    cookie: cookieA,
  });
  assert.equal(abandoned.res.status, 200);
  assert.equal(abandoned.json.session.status, 'abandoned');

  const completeAbandoned = await req(`/api/v1/study-sessions/${second.json.session._id}/complete`, {
    method: 'POST',
    cookie: cookieA,
    body: {},
  });
  assert.equal(completeAbandoned.res.status, 409);
});

test('summary totals match the completed focus session', async () => {
  const { res, json } = await req('/api/v1/study-sessions/summary', { cookie: cookieA });
  assert.equal(res.status, 200);
  assert.equal(json.completedFocusSessions, 1);
  assert.equal(json.totalFocusMinutes, 25);
  assert.equal(json.focusMinutesToday, 25);
  assert.equal(json.activeSession, null);
});

// ---- Ownership ----

test("user B cannot read or act on user A's quiz, deck, card or session", async () => {
  const getQuiz = await req(`/api/v1/quizzes/${quizA._id}`, { cookie: cookieB });
  assert.equal(getQuiz.res.status, 404);

  const attempt = await req(`/api/v1/quizzes/${quizA._id}/attempts`, {
    method: 'POST',
    cookie: cookieB,
    body: { answers: [0, 1] },
  });
  assert.equal(attempt.res.status, 404);

  const getDeck = await req(`/api/v1/flashcard-decks/${deckA._id}`, { cookie: cookieB });
  assert.equal(getDeck.res.status, 404);

  const review = await req(`/api/v1/flashcard-decks/${deckA._id}/cards/${card1._id}/review`, {
    method: 'POST',
    cookie: cookieB,
    body: { rating: 'good' },
  });
  assert.equal(review.res.status, 404);

  const complete = await req(`/api/v1/study-sessions/${sessionA._id}/complete`, {
    method: 'POST',
    cookie: cookieB,
    body: {},
  });
  assert.equal(complete.res.status, 404);

  // A's data is untouched by B's attempts.
  const mine = await req(`/api/v1/quizzes/${quizA._id}`, { cookie: cookieA });
  assert.equal(mine.res.status, 200);
});

// ---- Dashboard (Phase 4 metrics) ----

test('dashboard streak, focus minutes and quiz totals match stored data', async () => {
  const { res, json } = await req('/api/v1/dashboard', { cookie: cookieA });
  assert.equal(res.status, 200);
  // A quiz attempt and a completed Pomodoro both happened today.
  assert.ok(json.studyStreakDays >= 1);
  assert.equal(json.quizzesTaken, 1);
  assert.equal(json.averageQuizPercentage, 50);
  assert.equal(json.focusMinutesToday, 25);
  assert.equal(json.totalFocusMinutes, 25);
});

// ---- Deletes (last, so earlier tests keep their data) ----

test('owner can delete a quiz (attempts go too), a card and a deck', async () => {
  const delCard = await req(`/api/v1/flashcard-decks/${deckA._id}/cards/${card2._id}`, {
    method: 'DELETE',
    cookie: cookieA,
  });
  assert.equal(delCard.res.status, 200);

  const delDeck = await req(`/api/v1/flashcard-decks/${deckA._id}`, {
    method: 'DELETE',
    cookie: cookieA,
  });
  assert.equal(delDeck.res.status, 200);
  const deckGone = await req(`/api/v1/flashcard-decks/${deckA._id}`, { cookie: cookieA });
  assert.equal(deckGone.res.status, 404);

  const delQuiz = await req(`/api/v1/quizzes/${quizA._id}`, {
    method: 'DELETE',
    cookie: cookieA,
  });
  assert.equal(delQuiz.res.status, 200);
  const quizGone = await req(`/api/v1/quizzes/${quizA._id}`, { cookie: cookieA });
  assert.equal(quizGone.res.status, 404);
  const attemptsGone = await req(`/api/v1/quizzes/${quizA._id}/attempts`, { cookie: cookieA });
  assert.equal(attemptsGone.res.status, 404);
});
