# StudyMind — Architecture (Phase 1)

## Overview

Two separate apps, one repo:

- `client/` — Vite + React 18 SPA. React Router for pages, Tailwind CSS for styling.
  Talks to the backend through `/api` (Vite dev proxy) or `VITE_API_URL` in production.
- `server/` — Express 4 API. Mongoose for MongoDB. No business logic beyond the
  health endpoint in Phase 1.

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

## Auth (Phase 2, not yet)

- `POST /api/v1/auth/*` currently returns **501** with "Auth is coming in Phase 2".
  It is rate-limited (20 requests / 15 min). Nothing is faked: no login, no token,
  no session exists in Phase 1.

## Data model

See `docs/phase-0-design-feasibility.md` §5 for the full Phase 0 schema
(users, courses, notes, tasks, quizzes, quizAttempts, flashcardDecks, flashcards,
flashcardReviews, studySessions, gpaRecords, curatedSubjects). No Mongoose models
exist yet — they arrive with their phases.

## Key decisions

- JavaScript only (no TypeScript), per the master prompt.
- HttpOnly-cookie session strategy is planned for Phase 2; no token strategy is
  implemented in Phase 1.
- Dates are stored in UTC and displayed in the user's timezone (from Phase 3 on).
- No file uploads in the MVP; PDF handling is browser-local only (Phase 3+).
