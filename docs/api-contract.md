# StudyMind — API Contract (Phase 2)

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

## Auth — `/api/v1/auth/*` (Phase 2, real)

Auth uses a JWT (7-day expiry) in an HttpOnly cookie named `studymind_token`
(`sameSite: lax`, `secure` only in production). The browser must send
`credentials: "include"`; CORS allows the configured frontend origin(s) with
credentials. The server never returns `passwordHash` in any response.

Register/login are rate-limited to **10 requests per 15 minutes per IP**
(brute-force protection). All auth routes return **503** with
`{ "error": "Database unavailable. Please try again later." }` when MongoDB
is down — never a fake success.

### POST /api/v1/auth/register

Body: `{ "name", "email", "password" }` — name ≥ 2 chars, valid email,
password ≥ 8 chars (validated with Zod; invalid input → 400).

- **201** — `{ "user": { "_id", "name", "email", "role", "theme", "timezone", "gradingScale", "createdAt", "updatedAt" } }`, auth cookie set.
- **409** — `{ "error": "An account with this email already exists." }`

### POST /api/v1/auth/login

Body: `{ "email", "password" }`.

- **200** — `{ "user": {...} }`, auth cookie set.
- **401** — `{ "error": "Email or password is incorrect." }` (generic — no user enumeration).

### POST /api/v1/auth/logout

- **200** — `{ "ok": true }`, auth cookie cleared.

### GET /api/v1/auth/me

Requires the auth cookie (401 without a valid session).

- **200** — `{ "user": {...} }` (the logged-in user only).
- **401** — `{ "error": "Not authenticated. Please log in." }`

### POST /api/v1/auth/change-password

Requires the auth cookie. Body: `{ "currentPassword", "newPassword" }`
(new password ≥ 8 chars).

- **200** — `{ "ok": true }` (old password stops working immediately).
- **401** — current password wrong, or no valid session.

## Unknown routes

`GET /api/<anything-else>` → HTTP 404, `{ "error": "Not found" }`.

## Future endpoints (Phases 3–6, not implemented)

See `docs/phase-0-design-feasibility.md` §7 for the full endpoint plan
(`/courses`, `/notes`, `/tasks`, `/quizzes`, `/flashcard-decks`,
`/study-sessions`, `/gpa-records`, `/analytics/overview`, `/admin/subjects`).
