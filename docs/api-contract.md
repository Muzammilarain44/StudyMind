# StudyMind — API Contract (Phase 3)

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

## Courses, notes, tasks, dashboard — `/api/v1/*` (Phase 3, real)

All of these require the auth cookie (401 without a valid session). Every
read/write enforces ownership server-side: a document belonging to another
user behaves as if it does not exist (**404**, never 403 — no existence leak).
Supplying another user's `courseId` on a note/task is **400**. All routes
return **503** `{ "error": "Database unavailable. Please try again later." }`
when MongoDB is down. List endpoints are paginated: `?page` (default 1) and
`?limit` (default 20, max 100), returning `{ <items>, total, page, limit,
totalPages }`. Invalid input is **400** (Zod message); a malformed id in the
URL is **404**.

### Courses — `/api/v1/courses`

Course: `{ "_id", "userId", "title" (≤120), "code" (≤20, optional),
"semester", "colour" (hex, default "#4F46E5"), "creditHours" (0–12, optional),
"archived" (default false), "createdAt", "updatedAt" }`.

- `GET /api/v1/courses` — `?archived`, `?semester`, `?search` (title substring).
- `POST /api/v1/courses` — **201** `{ "course" }`. Title and semester required.
- `GET /api/v1/courses/:id` — **200** `{ "course" }`, else 404.
- `PUT /api/v1/courses/:id` — partial update (archive/unarchive via `{ "archived": true/false }`). **200** `{ "course" }`.
- `DELETE /api/v1/courses/:id` — **200** `{ "ok": true }`. Does not delete notes/tasks.

### Notes — `/api/v1/notes`

Note: `{ "_id", "userId", "courseId" (nullable), "title" (≤200),
"contentMarkdown", "tags" (≤10, each ≤30), "pinned", "archived",
"createdAt", "updatedAt" }`.

- `GET /api/v1/notes` — `?search` (title/content substring), `?courseId`, `?tag`, `?pinned`, `?archived`. Pinned notes sort first, then most recently updated.
- `POST /api/v1/notes` — **201** `{ "note" }`.
- `GET /api/v1/notes/:id` — **200** `{ "note" }`, else 404.
- `PUT /api/v1/notes/:id` — also the autosave endpoint; partial update, returns the updated note with a new `updatedAt`. **200** `{ "note" }`.
- `DELETE /api/v1/notes/:id` — **200** `{ "ok": true }`.

### Tasks — `/api/v1/tasks`

Task: `{ "_id", "userId", "courseId" (nullable), "title" (≤200),
"description" (≤2000), "dueDate" (ISO date, nullable), "priority"
("low" | "medium" | "high", default "medium"), "completed",
"completedAt" (nullable), "createdAt", "updatedAt" }`.

- `GET /api/v1/tasks` — `?completed`, `?courseId`, `?priority`, `?dueBefore`, `?dueAfter` (ISO dates).
- `POST /api/v1/tasks` — **201** `{ "task" }`. Creating with `completed: true` stamps `completedAt`.
- `GET /api/v1/tasks/:id` — **200** `{ "task" }`, else 404.
- `PUT /api/v1/tasks/:id` — partial update. `completed: true` stamps `completedAt`; `completed: false` clears it. **200** `{ "task" }`.
- `DELETE /api/v1/tasks/:id` — **200** `{ "ok": true }`.

### Dashboard — `/api/v1/dashboard`

`GET /api/v1/dashboard` — **200**, all numbers calculated from the logged-in
user's own stored data only:

```json
{
  "totalCourses": 1, "activeCourses": 1,
  "totalTasks": 1, "completedTasks": 1,
  "overdueTasks": 0, "dueTodayTasks": 0, "dueNext7Days": 0,
  "recentNotes": [{ "_id", "title", "courseId", "courseTitle", "updatedAt", "pinned" }],
  "nextTasks": [{ "_id", "title", "courseId", "dueDate", "priority" }],
  "tasksByCourse": [{ "courseId", "title", "colour", "total", "completed" }]
}
```

Overdue = incomplete with `dueDate` before now. "Due today / next 7 days" count
incomplete tasks only. No study-time or quiz fields exist yet — they are not
invented; they arrive in Phases 4–5.

## Unknown routes

`GET /api/<anything-else>` → HTTP 404, `{ "error": "Not found" }`.

## Future endpoints (Phases 4–6, not implemented)

See `docs/phase-0-design-feasibility.md` §7 for the remaining endpoint plan
(`/quizzes`, `/flashcard-decks`, `/study-sessions`, `/gpa-records`,
`/analytics/overview`, `/admin/subjects`).
