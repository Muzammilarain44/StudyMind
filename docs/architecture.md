# StudyMind — Architecture (Phase 6 — final)

## Overview

Two separate apps, one repo:

- `client/` — Vite + React 18 SPA. React Router for pages, Tailwind CSS for styling,
  Recharts for analytics charts (code-split: the charts chunk loads only on the
  Analytics page). Talks to the backend through `/api` (Vite dev proxy) or
  `VITE_API_URL` in production.
- `server/` — Express 4 API. Mongoose for MongoDB. Auth (Phase 2), courses,
  notes, tasks and a real dashboard endpoint (Phase 3), quizzes, flashcards
  and Pomodoro sessions (Phase 4), plus GPA, analytics, settings and admin
  (Phase 5).

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
`StudySession` (Phase 4), `GpaRecord`, `CuratedSubject` (Phase 5). `Quiz` has
an `isSample` flag for platform sample quizzes. See
`docs/phase-0-design-feasibility.md` §5 for the full Phase 0 schema. Notes
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

## GPA and grading scales (Phase 5)

- A `GpaRecord` is one saved grade: a title, a semester, a letter grade
  (`A`–`F`) and credit hours. Credit hours come from the record itself or
  are copied from a linked course at creation; a grade with no credits is
  rejected (400) because it cannot be weighted.
- The grade→points map lives on the user (`User.gradingScale`, default 4.0:
  A 4.0, A- 3.7, B+ 3.3, B 3.0, B- 2.7, C+ 2.3, C 2.0, D 1.0, F 0).
  Users edit their own scale in Settings / on the GPA page; the scale is
  validated (letters A–F only, points 0–5) and merged, never replaced wholesale.
- `GET /gpa-records/compute` runs `computeGpa()` (`server/src/gpa.js`):
  credit-weighted average over the user's records, plus a per-semester
  breakdown. The response is always labelled `estimate: true` — universities
  use different scales and policies, and StudyMind never claims an official GPA.

## Analytics (Phase 5)

- `GET /analytics/overview` aggregates the user's own stored data only:
  completed focus sessions, completed tasks and quiz attempts. Default range
  is the last 30 days ending today (`?from`/`?to`, max 366 days).
- The response has totals, one daily entry per day in the range (zero-filled),
  and a per-course breakdown. Focus sessions carry no course, so they appear
  in totals/daily only. An empty range returns zeros — the client shows an
  honest empty state, never invented numbers.
- Charts use Recharts on the client. The Analytics page is lazy-loaded
  (`React.lazy` in `App.jsx`) so the charts chunk (~419 kB) does not bloat
  the main bundle.

## Settings (Phase 5)

- `PATCH /settings` updates theme (`light`/`dark`), timezone (validated
  against the platform's IANA list when available) and the grading scale.
  The theme is applied to the document immediately and stored in
  `localStorage` (`client/src/lib/theme.js`); the topbar toggle also persists
  it to the server when logged in, and adopts the server value on login.
- `GET /settings/export?format=json|csv` returns every document the user
  owns, as a file download. CSV has one `## Section` per collection.
- `DELETE /settings/account` verifies the password, then deletes the user and
  every owned document (courses, notes, tasks, quizzes, attempts, decks,
  cards, reviews, sessions, GPA records) and clears the cookie. Platform
  content — curated subjects and sample quizzes — is kept, because other
  users rely on it.

## Admin authorization and sample content (Phase 5)

- The `User.role` field is `student` or `admin` (default `student`). Admin
  routes use `requireRole('admin')` after `requireAuth`; the role is read
  from the database on every request, never trusted from the client or the
  JWT payload alone.
- There is **no open admin self-registration**. The only promotion path is
  the command-line script (see `docs/setup.md`):
  `node scripts/promote-admin.js <email>`, which sets `role: 'admin'` for an
  existing user. Run it with `MONGODB_URI` set (from `server/.env`).
- Admins manage curated subjects (`CuratedSubject`) and sample quiz banks
  (`Quiz` rows with `isSample: true`) and see aggregate usage counts only
  (`GET /admin/stats`) — counts, never private student content.
- Students browse curated subjects and sample quizzes (answers hidden) and
  copy a sample into their own quizzes (`POST /admin/sample-quizzes/:id/copy`).
- `scripts/seed-samples.js <admin-email>` seeds 5 curated CS subjects and 2
  sample quizzes. It is idempotent: re-running it creates nothing new.

## Polish & QA (Phase 6 — final)

- **Responsive:** the top bar and the mobile bottom bar both scroll
  horizontally instead of overflowing — at 1280px the 13-link top bar used
  to push the theme toggle 20px past the viewport edge; the mobile bar holds
  the same 13 links by scrolling. Every page was checked at 1280px and
  390px in a real browser (no horizontal overflow on either).
- **Dark mode:** applied before first paint by an inline script in
  `client/index.html` (reads `localStorage`, adds `.dark`), so dark-mode
  users never see a white flash. Charts use a slate tick/grid colour that
  reads on both themes.
- **Accessibility:** a global `:focus-visible` outline in `index.css`
  (Tailwind's preflight removes outlines); all inputs have labels, dialogs
  use `window.confirm`, timers/flip-cards/progress bars carry `role` and
  `aria-label`/`aria-pressed`/`aria-valuenow`.
- **Auth context refresh:** `useAuth()` exposes `refresh()`, which re-reads
  `/auth/me`. Settings and GPA call it after saving, so Profile shows the
  new theme/timezone/scale immediately (Phase 5 needed a reload).
- **Course delete integrity:** deleting a course clears `courseId` to `null`
  on the owner's notes, tasks, quizzes, flashcard decks and GPA records
  instead of leaving orphaned references to a deleted course. Nothing the
  user wrote is deleted.
- **Date validation:** invalid `dueBefore`/`dueAfter` on `GET /tasks` is a
  400 with a clear message (it used to fall through to a CastError → 404).
- **Security audit (Phase 6):** every router except `common.js` (helpers)
  applies `requireAuth`; all `$regex` searches escape user input; no
  `eval`/`Function`/`$where`; the only `dangerouslySetInnerHTML` is the
  Notes Markdown preview, sanitized with DOMPurify; cookies are HttpOnly,
  `sameSite: 'lax'`, `secure` in production; production refuses to start
  without a ≥32-char `JWT_SECRET`; no `.env` or secret is committed
  (verified by grep); Helmet + CORS allowlist + rate limits (300/15 min
  API-wide, 10/15 min on register/login) are on in `app.js`.
- **Performance:** main bundle 359.54 kB (gzip 106.28 kB), Analytics chunk
  418.93 kB (gzip 120.34 kB, lazy-loaded) — unchanged from Phase 5; no new
  dependencies in Phase 6.
- **End-to-end:** the full user journey was driven in a real headless
  Chromium against the built client + real server (45/45 checks pass — see
  `docs/test-checklist.md`). The *deployed* end-to-end test is still
  **blocked** on deployment (Atlas/Render/Vercel manual steps in
  `docs/setup.md`); no live URL exists yet and none is claimed.
