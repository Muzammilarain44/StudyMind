# StudyMind — Architecture (Phase 4)

## Overview

Two separate apps, one repo:

- `client/` — Vite + React 18 SPA. React Router for pages, Tailwind CSS for styling.
  Talks to the backend through `/api` (Vite dev proxy) or `VITE_API_URL` in production.
- `server/` — Express 4 API. Mongoose for MongoDB. Auth (Phase 2), courses,
  notes, tasks and a real dashboard endpoint (Phase 3), plus quizzes,
  flashcards and Pomodoro sessions (Phase 4).

## Request flow (dev)

```
Browser (http://localhost:5173)
  -> Vite dev server, /api proxied to http://localhost:5000
  -> Express (helmet, cors, json, morgan)
  -> GET /api/health -> { status, db, timestamp }
```

## Server layout

- `server/src/index.js` — entry point: loads `.env`, connects to MongoDB in the
  background, starts listening on `PORT` (default 5000).
- `server/src/app.js` — `createApp()` builds the Express app (routes, middleware,
  error handler). Kept separate from `index.js` so tests can import the app without
  starting a server or a DB connection.
- `server/src/db.js` — `connectDb(uri)` / `dbStatus()`. Connecting is optional and
  never throws: a missing or unreachable DB logs a warning and the API still starts.
- `server/test/health.test.js` — `node:test` tests for the health endpoints and the
  auth placeholder.

## Auth (Phase 2, live)

- `POST /api/v1/auth/register|login|logout`, `GET /api/v1/auth/me`,
  `POST /api/v1/auth/change-password`. JWT (7-day) in an HttpOnly cookie
  (`studymind_token`, `sameSite: lax`, `secure` only in production).
  Register/login are rate-limited (10 per 15 min / IP). `requireAuth`
  middleware loads the user from the cookie; `requireRole` gates admin routes.
- Phase 3 routers (`courses`, `notes`, `tasks`, `dashboard`) all sit behind
  `requireAuth` and enforce ownership with `{ _id, userId }` filters — another
  user's document returns 404, never 403. A shared `requireDb` guard returns
  503 instead of hanging when MongoDB is down.

## Data model

Mongoose models so far: `User` (Phase 2), `Course`, `Note`, `Task` (Phase 3),
`Quiz`, `QuizAttempt`, `FlashcardDeck`, `Flashcard`, `FlashcardReview`,
`StudySession` (Phase 4). See `docs/phase-0-design-feasibility.md` §5 for the
full Phase 0 schema (gpaRecords and the rest arrive with their phases). Notes
render Markdown in the browser with `marked` + `DOMPurify` — raw user HTML is
never injected unsanitized.

## Key decisions

- JavaScript only (no TypeScript), per the master prompt.
- HttpOnly-cookie JWT sessions (Phase 2); no token is ever exposed to JavaScript.
- The dashboard only ever shows numbers computed from stored data. Phase 4
  adds the study streak, focus minutes and quiz totals to it.
- Dates are stored in UTC and displayed in the user's timezone (from Phase 3 on).
- No file uploads in the MVP; PDF handling is browser-local only (Phase 3+).

## Quiz grading (Phase 4)

- A quiz is a user-created bank of MCQ questions; each question has 2–6
  options and exactly one `correctIndex`, validated by Zod on the route and by
  the Mongoose schema (correctIndex must point at an option).
- Attempts are graded **server-side** at submit time (`POST /quizzes/:id/attempts`).
  The client sends only the chosen option indexes; the server counts correct
  answers, stores the attempt, and returns the score plus per-question results
  (correct answer + explanation) — only after submit, never before.
- `GET /quizzes/stats` aggregates the user's own attempts: total attempts,
  average and best percentage, and a per-course breakdown.

## Spaced repetition — "SM-2-lite" (Phase 4)

Flashcard reviews use a deliberately simple, documented variant of SM-2
(`server/src/srs.js`). There is no ease factor to tune and no hidden state:
the next interval depends only on the rating and the interval the card had
before this review. New cards (no previous review) start from the base
intervals.

| Rating | New card | Card with previous interval N days |
|--------|----------|------------------------------------|
| again  | 1 day    | 1 day (the card restarts)          |
| hard   | 1 day    | max(1, round(N × 1.2)) days        |
| good   | 3 days   | round(N × 2.5) days                |
| easy   | 7 days   | round(N × 3.5) days                |

`nextDue` is always `reviewedAt + intervalDays` in whole days, so a card
reviewed today is never due again today (except "again", which is due
tomorrow). Each `FlashcardReview` row stores its rating, interval and
`nextDue`, so the schedule is auditable from the data. The due queue
(`GET /flashcard-decks/:id/due`) returns cards never reviewed, or whose
latest review's `nextDue` has passed — new cards first, then most overdue.

## Pomodoro idempotency (Phase 4)

- A session is created once when the timer starts (`POST /study-sessions`,
  status `active`) and completed exactly once (`POST /study-sessions/:id/complete`).
  Completing a finished or abandoned session is **409**.
- The client sends a `clientKey` (a UUID generated per timer start). A retry
  with the same key returns the existing session with `duplicate: true`
  instead of creating a second one, and a unique `{ userId, clientKey }`
  index enforces this even for concurrent retries.
- On page load the Pomodoro page fetches the user's active session and
  resumes its countdown from the server `startedAt` + `plannedMinutes`,
  so a tab refresh never double-counts focus time.

## Study streak (Phase 4)

Per the Phase 0 definition, a day counts when the user completed at least
**1 task, OR 1 Pomodoro focus session, OR 1 quiz attempt**. The dashboard
computes consecutive active days back from today (if today has no activity
yet, the streak is counted from yesterday — it is still alive). Break
sessions do not count toward the streak.
