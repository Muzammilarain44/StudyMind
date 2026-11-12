# StudyMind — API Contract (Phase 6 — final)

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
- `DELETE /api/v1/courses/:id` — **200** `{ "ok": true }`. Does not delete notes/tasks — their `courseId` link is cleared to `null` instead (Phase 6), so nothing the user wrote is lost.

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

- `GET /api/v1/tasks` — `?completed`, `?courseId`, `?priority`, `?dueBefore`, `?dueAfter` (ISO dates). An invalid `dueBefore`/`dueAfter` value is **400** (Phase 6 — it used to fall through to a CastError → 404).
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
incomplete tasks only. Phase 4 adds real study numbers from stored data:

```json
{
  "studyStreakDays": 3,
  "focusMinutesToday": 25,
  "totalFocusMinutes": 150,
  "quizzesTaken": 4,
  "averageQuizPercentage": 72
}
```

`studyStreakDays` is consecutive days (ending today, or yesterday if today has
no activity yet) with at least 1 completed task, 1 completed Pomodoro focus
session, or 1 quiz attempt. `averageQuizPercentage` is `null` when no quiz has
been attempted yet.

## Quizzes, flashcards, Pomodoro — `/api/v1/*` (Phase 4, real)

Same auth (401 without a valid session) and ownership rules as Phase 3:
another user's document behaves as if it does not exist (**404**). All routes
return **503** when MongoDB is down. List endpoints are paginated as above.

### Quizzes — `/api/v1/quizzes`

Quiz: `{ "_id", "userId", "title" (≤120), "description" (≤500, optional),
"courseId" (nullable), "timeLimitSeconds" (10–14400, optional, null = no timer),
"questions" (1–100), "archived" (default false), "createdAt", "updatedAt" }`.
Question: `{ "question" (≤500), "options" (2–6, each ≤200), "correctIndex"
(points at exactly one option), "explanation" (≤1000, optional) }`.

- `GET /api/v1/quizzes` — `?courseId`, `?search` (title substring), `?archived`.
  The list returns `questionCount` instead of the questions array.
- `POST /api/v1/quizzes` — **201** `{ "quiz" }`.
- `GET /api/v1/quizzes/stats` — **200** `{ "totalQuizzes", "totalAttempts",
  "averagePercentage", "bestPercentage", "byCourse": [{ "courseId", "courseTitle",
  "quizzes", "attempts", "averagePercentage" }] }`. `?courseId` narrows to one course.
  Averages are `null` when there are no attempts yet.
- `GET /api/v1/quizzes/:id` — **200** `{ "quiz" }` (full quiz, with questions), else 404.
- `PUT /api/v1/quizzes/:id` — partial update. **200** `{ "quiz" }`.
- `DELETE /api/v1/quizzes/:id` — **200** `{ "ok": true }`. Also deletes its attempts.
- `POST /api/v1/quizzes/:id/attempts` — body `{ "answers" (one option index per
  question, in order), "timeTakenSeconds" (optional) }`. Graded server-side.
  **201** `{ "attempt": { "score", "total", "percentage", ... }, "results": [{
  "questionIndex", "question", "selected", "correctIndex", "correct",
  "explanation" }] }`. Wrong answer count → 400; out-of-range answer → 400.
- `GET /api/v1/quizzes/:id/attempts` — attempt history, newest first.

### Flashcard decks — `/api/v1/flashcard-decks`

Deck: `{ "_id", "userId", "title" (≤120), "description" (≤500, optional),
"courseId" (nullable), "createdAt", "updatedAt" }`. Card: `{ "_id", "userId",
"deckId", "front" (≤1000), "back" (≤2000), "createdAt", "updatedAt" }`.
Review: `{ "_id", "userId", "cardId", "deckId", "rating" ("again" | "hard" |
"good" | "easy"), "intervalDays", "nextDue", "reviewedAt" }`.

- `GET /api/v1/flashcard-decks` — `?courseId`. Each deck includes `cardCount`.
- `POST /api/v1/flashcard-decks` — **201** `{ "deck" }`.
- `GET /api/v1/flashcard-decks/:id` — **200** `{ "deck" }` (with `cardCount`), else 404.
- `PUT /api/v1/flashcard-decks/:id` — partial update. **200** `{ "deck" }`.
- `DELETE /api/v1/flashcard-decks/:id` — **200** `{ "ok": true }`. Also deletes its cards and reviews.
- `GET /api/v1/flashcard-decks/:id/cards` — list cards in the deck.
- `POST /api/v1/flashcard-decks/:id/cards` — **201** `{ "card" }`.
- `GET /api/v1/flashcard-decks/:id/due` — **200** `{ "deckId", "dueCount",
  "cards": [...] }`: cards never reviewed, or whose latest review's `nextDue`
  has passed. New cards first, then most overdue. `?limit` (default 20, max 100).
- `PUT /api/v1/flashcard-decks/:id/cards/:cardId` — partial update. **200** `{ "card" }`.
- `DELETE /api/v1/flashcard-decks/:id/cards/:cardId` — **200** `{ "ok": true }`. Also deletes its reviews.
- `POST /api/v1/flashcard-decks/:id/cards/:cardId/review` — body `{ "rating" }`.
  Applies the SM-2-lite schedule (see `docs/architecture.md`): new card rated
  "good" → 3 days, "easy" → 7 days, "again" → 1 day. **201** `{ "review", "card" }`.
  Bad rating → 400.
- `GET /api/v1/flashcard-decks/:id/cards/:cardId/reviews` — review history, newest first.

### Study sessions (Pomodoro) — `/api/v1/study-sessions`

Session: `{ "_id", "userId", "type" ("focus" | "break"), "plannedMinutes" (1–240),
"actualMinutes" (nullable until completed), "status" ("active" | "completed" |
"abandoned"), "clientKey", "startedAt", "completedAt" (nullable), "createdAt",
"updatedAt" }`.

- `POST /api/v1/study-sessions` — body `{ "type" (default "focus"),
  "plannedMinutes" (default 25), "clientKey" (required) }`. Idempotent on
  `clientKey`: a retry returns the existing session with **200**
  `{ "session", "duplicate": true }` instead of creating a duplicate.
  New session → **201** `{ "session", "duplicate": false }`.
- `GET /api/v1/study-sessions` — `?status`, `?type`, pagination. Newest first.
- `GET /api/v1/study-sessions/summary` — **200** `{ "completedFocusSessions",
  "totalFocusMinutes", "focusMinutesToday", "focusSessionsToday",
  "activeSession" (or null) }`.
- `POST /api/v1/study-sessions/:id/complete` — body `{ "actualMinutes" (optional,
  defaults to plannedMinutes) }`. **200** `{ "session" }`. Completing a session
  that is already completed or abandoned → **409**.
- `POST /api/v1/study-sessions/:id/abandon` — **200** `{ "session" }`. Only an
  active session can be abandoned (otherwise **409**).

## GPA, analytics, settings, admin — `/api/v1/*` (Phase 5, real)

Same auth (401 without a valid session) and ownership rules as Phase 3:
another user's document behaves as if it does not exist (**404**). All routes
return **503** when MongoDB is down. List endpoints are paginated as above.

### GPA records — `/api/v1/gpa-records`

GPA record: `{ "_id", "userId", "courseId" (nullable), "title" (≤120),
"semester" (≤60, optional), "grade" ("A" | "A-" | "B+" | "B" | "B-" | "C+" |
"C" | "D" | "F"), "creditHours" (0–12, required), "createdAt", "updatedAt" }`.

- `GET /api/v1/gpa-records` — `?semester`, `?search` (title substring).
- `POST /api/v1/gpa-records` — **201** `{ "record" }`. Credit hours are
  required: either send `creditHours`, or link a `courseId` whose course has
  credit hours (they are copied onto the record). No credits available → 400.
  Another user's `courseId` → 400.
- `GET /api/v1/gpa-records/compute` — **200** `{ "gpa", "totalCredits",
  "totalPoints", "bySemester": [{ "semester", "gpa", "totalCredits",
  "records" }], "recordCount", "scale", "estimate": true, "note" }`.
  Credit-weighted GPA computed server-side from the user's own records with
  the user's own grading scale (default 4.0). `gpa` is `null` when there are
  no credited records. The result is always labelled an estimate — grading
  scales and policies differ by university.
- `GET /api/v1/gpa-records/:id` — **200** `{ "record" }`, else 404.
- `PUT /api/v1/gpa-records/:id` — partial update; credits re-resolve when the
  course link changes. **200** `{ "record" }`.
- `DELETE /api/v1/gpa-records/:id` — **200** `{ "ok": true }`.

### Analytics — `/api/v1/analytics/overview`

`GET /api/v1/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD` — **200**,
all numbers calculated from the logged-in user's own stored data only
(completed focus sessions, completed tasks, quiz attempts). Default range:
last 30 days ending today; max range 366 days; `from` after `to` → 400;
bad date → 400.

```json
{
  "from": "2026-10-14", "to": "2026-11-12",
  "totals": { "totalFocusMinutes": 25, "completedFocusSessions": 1,
    "tasksCompleted": 1, "totalQuizAttempts": 1, "averageQuizPercentage": 50,
    "bestQuizPercentage": 50 },
  "daily": [{ "date": "2026-11-12", "focusMinutes": 25, "tasksCompleted": 1,
    "quizAttempts": 1, "averageQuizPercentage": 50 }],
  "byCourse": [{ "courseId", "courseTitle", "tasksCompleted": 1, "quizzes": 1,
    "quizAttempts": 1, "averageQuizPercentage": 50 }]
}
```

`daily` has one entry per day in the range, even with no activity.
Averages are `null` when there are no attempts. An empty range returns zeros
and empty series — never invented numbers.

### Settings — `/api/v1/settings`

- `PATCH /api/v1/settings` — body `{ "theme" ("light" | "dark"), "timezone"
  (IANA name, e.g. "Asia/Karachi"), "gradingScale" (partial map of letter →
  points, 0–5) }`. Partial update; the grading scale is merged with the
  existing one. **200** `{ "user": {...} }`. Bad theme/timezone/scale → 400.
- `GET /api/v1/settings/export?format=json|csv` — **200**, downloads ALL of
  the requesting user's own data (courses, notes, tasks, quizzes, quiz
  attempts, flashcard decks/cards/reviews, study sessions, GPA records) as a
  file attachment. JSON is one object; CSV has one `## Section` per
  collection. Never includes another user's data.
- `DELETE /api/v1/settings/account` — body `{ "password" }`. Verifies the
  password (wrong → 401), then deletes the user and ALL of their owned data
  and clears the auth cookie. Platform content (curated subjects and sample
  quizzes) is not deleted. **200** `{ "ok": true }`.

### Admin — `/api/v1/admin/*`

All admin routes require the auth cookie. Write routes and `/stats` require
the server-side `admin` role (**403** for students). There is no open admin
self-registration — see `docs/setup.md` for the promotion script.

- `GET /api/v1/admin/stats` — **200** counts only: `{ "users", "courses",
  "notes", "tasks", "quizzes", "quizAttempts", "flashcardDecks", "flashcards",
  "studySessions", "gpaRecords", "curatedSubjects" }`. No private content.
- `GET /api/v1/admin/subjects` — any logged-in user; `?search`, `?category`.
- `POST /api/v1/admin/subjects` — admin only. **201** `{ "subject" }`.
  Subject: `{ "_id", "title" (≤120), "code" (≤20, optional), "description"
  (≤500, optional), "category" (≤60, default "Computer Science"),
  "createdBy", "createdAt", "updatedAt" }`.
- `GET /api/v1/admin/subjects/:id` — any logged-in user. **200** `{ "subject" }`.
- `PUT /api/v1/admin/subjects/:id` — admin only. `DELETE` — admin only.
- `GET /api/v1/admin/sample-quizzes` — any logged-in user. Sample quizzes
  are returned WITHOUT correct answers (questions have `question` + `options`
  only) and with `questionCount`.
- `POST /api/v1/admin/sample-quizzes` — admin only. Same validation as
  creating a quiz. **201** `{ "quiz" }` (`isSample: true`).
- `GET /api/v1/admin/sample-quizzes/:id` — any logged-in user, answers hidden.
- `PUT /api/v1/admin/sample-quizzes/:id` — admin only. `DELETE` — admin only.
- `POST /api/v1/admin/sample-quizzes/:id/copy` — any logged-in user. Copies
  the sample into the student's own quizzes (`isSample: false`). **201**
  `{ "quiz" }`.

## Unknown routes

`GET /api/<anything-else>` → HTTP 404, `{ "error": "Not found" }`.

## Phase 6 — polish & QA (done, no new endpoints)

Phase 6 added no new endpoints. It fixed two behaviours (course-delete link
cleanup, invalid task date filters → 400 — see above), audited the whole app
in a real browser (see `docs/test-checklist.md`), and added
`docs/demo-script.md` plus screenshots in `docs/screenshots/`.
