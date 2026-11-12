# StudyMind — Architecture (Phase 3)

## Overview

Two separate apps, one repo:

- `client/` — Vite + React 18 SPA. React Router for pages, Tailwind CSS for styling.
  Talks to the backend through `/api` (Vite dev proxy) or `VITE_API_URL` in production.
- `server/` — Express 4 API. Mongoose for MongoDB. Auth (Phase 2) plus courses,
  notes, tasks and a real dashboard endpoint (Phase 3).

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

Mongoose models so far: `User` (Phase 2), `Course`, `Note`, `Task` (Phase 3).
See `docs/phase-0-design-feasibility.md` §5 for the full Phase 0 schema
(quizzes, flashcardDecks, studySessions, gpaRecords and the rest arrive with
their phases). Notes render Markdown in the browser with `marked` +
`DOMPurify` — raw user HTML is never injected unsanitized.

## Key decisions

- JavaScript only (no TypeScript), per the master prompt.
- HttpOnly-cookie JWT sessions (Phase 2); no token is ever exposed to JavaScript.
- Spaced-repetition, GPA and analytics arrive in Phases 4–5; the dashboard
  only ever shows numbers computed from stored data.
- Dates are stored in UTC and displayed in the user's timezone (from Phase 3 on).
- No file uploads in the MVP; PDF handling is browser-local only (Phase 3+).
