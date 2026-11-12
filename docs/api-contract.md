# StudyMind — API Contract (Phase 1)

Base prefix for versioned endpoints: `/api/v1`. The health endpoint is also
available unversioned at `/api/health` for deployment checks.

All responses are JSON unless stated otherwise. No endpoint returns secrets.

## GET /api/health

Also available as `GET /api/v1/health` (identical response).

**Purpose:** deployment / liveness check.

**Success (database connected) — HTTP 200:**

```json
{ "status": "ok", "db": "connected", "timestamp": "2026-11-11T12:00:00.000Z" }
```

**Database disconnected — HTTP 503 (not a crash):**

```json
{ "status": "degraded", "db": "disconnected", "timestamp": "2026-11-11T12:00:00.000Z" }
```

| Field | Type | Meaning |
|---|---|---|
| `status` | string | `"ok"` when the DB is connected, `"degraded"` otherwise |
| `db` | string | `"connected"` or `"disconnected"` |
| `timestamp` | string | ISO 8601 timestamp of the check |

## GET /

Plain-text response: `StudyMind API running`. HTTP 200.

## /api/v1/auth/* (placeholder)

All methods return **HTTP 501**:

```json
{ "error": "Auth is coming in Phase 2 — not implemented yet." }
```

Rate-limited: 20 requests per 15 minutes per IP. Auth (register/login/logout,
sessions) is Phase 2 — nothing is faked here.

## Unknown routes

`GET /api/<anything-else>` → HTTP 404, `{ "error": "Not found" }`.

## Future endpoints (Phases 2–6, not implemented)

See `docs/phase-0-design-feasibility.md` §7 for the full endpoint plan
(`/auth/*`, `/courses`, `/notes`, `/tasks`, `/quizzes`, `/flashcard-decks`,
`/study-sessions`, `/gpa-records`, `/analytics/overview`, `/admin/subjects`).
