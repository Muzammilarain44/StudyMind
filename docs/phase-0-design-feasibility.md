# StudyMind — Phase 0: Design & Feasibility

**Date:** 2026-11-11
**Status:** Draft — awaiting Muzammil's approval before Phase 1
**Budget:** PKR 0 — no paid API, paid AI, paid domain, paid storage, payment gateway, or credit-card-required service
**Stack (fixed by master prompt):** React + Vite, Node.js + Express, MongoDB + Mongoose, Tailwind CSS, JavaScript
**Deployment target:** Vercel (frontend) + Render Free web service (backend) + MongoDB Atlas Free cluster (database)
**Important:** This is a NEW, standalone project. It is NOT VU StudyMate AI, NOT Techzone, NOT Ayra. No code, data, or accounts are shared with those projects unless Muzammil explicitly says so.

---

## 1. What StudyMind is (and is not)

A student learning workspace for university / college students:
course organisation, personal notes, study planning, MCQ quizzes, flashcards, Pomodoro sessions, GPA calculation, and progress analytics.

**It is NOT:**
- A generative-AI product. No LLM, no AI chatbot, no AI-generated questions in MVP.
- Quiz questions and flashcards are created by users / admins only.
- A real production SaaS for paying users. It is a professional portfolio project, built honestly with real data.

**Honesty rules (from master prompt):**
- No fake metrics, no fake charts, no demo counters, no dead buttons.
- Dashboard numbers are calculated from the user's own stored data only.
- Streak, GPA and analytics are clearly defined and clearly marked as estimates where they are estimates.
- PDF is local-only in MVP (browser preview / text extraction with PDF.js). No claim of cloud sync.

---

## 2. Feature scope — MVP

### In scope (Phases 1–6)

| # | Module | MVP behaviour |
|---|--------|---------------|
| 1 | Auth | Register, login, logout, session restore, hashed passwords (bcrypt), protected routes, rate limits on auth, HttpOnly cookie session/token, profile |
| 2 | Dashboard | Real metrics from stored data: next tasks, study streak (defined below), recent notes, subject progress, upcoming deadlines, study time, quiz results |
| 3 | Courses / Subjects | CRUD, colour, semester, optional credit hours, archive, per-user ownership |
| 4 | Notes | Markdown editor with safe rendering, autosave with clear state (Saving / Saved / Error), search / filter, tags, pin / archive, subject association |
| 5 | Study Planner | Tasks, due dates, priorities, completion, calendar + list views, timezone-safe dates (store UTC, display in user timezone). In-app reminders only — NO background push alerts promised in MVP |
| 6 | Quiz engine | User/admin-created question banks, MCQ (4 options, 1 correct), optional timer, auto-grading, explanations, attempt history, per-subject stats |
| 7 | Flashcards | Decks, front/back, flip animation, spaced repetition with a documented simple algorithm (see §6), review queue synced with DB |
| 8 | Pomodoro | Configurable focus / break lengths, pause / resume, session history, no double-counting on tab refresh (one active session record, completed only once) |
| 9 | GPA / CGPA | Configurable grading scale, credit-weighted GPA, clearly marked as estimate, no assumption that every university uses the same policy |
| 10 | Analytics | Study sessions, completed tasks, quiz scores, subject breakdown, real charts (Recharts), date filters, meaningful empty states |
| 11 | Settings | Profile, password change, theme (light/dark), timezone, data export (JSON / CSV), account deletion with confirmation |
| 12 | Admin panel | Server-verified admin role only. Manage curated subjects + sample quiz banks, view basic aggregate usage counts. NO access to private student notes. NO open admin self-registration |

### Out of scope for MVP (later, only if approved)
- Generative AI, AI chatbot, AI question generation
- Push notifications / email reminders / background alerts
- File upload / cloud PDF storage (needs a separately approved storage design + free-quota check first)
- Payments, paid plans, teams / classrooms, sharing notes with other users
- Mobile app (web responsive only in MVP)
- Social login (Google/GitHub) — email + password only in MVP

### Open decisions for Muzammil (proposed defaults in brackets)
1. **UI language:** English only [proposed — same as Techzone website].
2. **GPA scale default:** 4.0 scale, A = 4.0, A- = 3.7, B+ = 3.3, B = 3.0, B- = 2.7, C+ = 2.3, C = 2.0, D = 1.0, F = 0 — user can change it in Settings [proposed — common Pakistan / VU-style 4.0 scale, configurable].
3. **Study streak definition:** a day counts if the user logs at least 1 completed Pomodoro session OR completes at least 1 task OR attempts 1 quiz that day [proposed — simple, honest, shown on Dashboard with this definition].
4. **Pomodoro defaults:** 25 min focus / 5 min short break / 15 min long break after 4 cycles [proposed — standard, user-configurable].
5. **Sample / curated content:** Admin-curated subjects + sample quiz banks for common CS subjects (e.g. Programming, Databases, Data Structures) [proposed — Muzammil to confirm subject list, or start with empty curated list and add later].
6. **Repo name:** `studymind` on GitHub (Muzammilarain44/studymind) [proposed — to confirm before Phase 1].

---

## 3. User journeys

### Student — first day
1. Lands on public home / login page → Register (name, email, password) → account created, logged in.
2. Onboarding empty state: "Create your first course" → creates e.g. "Database Systems, Semester 5, 3 credit hours, blue".
3. Adds a note to that course (Markdown), autosave shows "Saved".
4. Adds 3 tasks with due dates / priorities → Dashboard shows next tasks + upcoming deadlines.
5. Starts a 25-min Pomodoro → completes it → session saved → Dashboard study time + streak update.
6. Creates a 5-question MCQ quiz for the course → attempts it → auto-graded score + explanations → history saved.
7. Creates a flashcard deck (10 cards) → reviews → next review dates set by spaced-repetition algorithm.
8. Adds GPA records (course + grade + credit hours) → GPA / CGPA shown as estimate.
9. Checks Analytics (last 7 / 30 days) → real charts from own data, or honest empty state if no data yet.
10. Settings: changes theme to dark, sets timezone Asia/Karachi, exports data as JSON.

### Student — returning day
Login → session restored → Dashboard shows streak, today's tasks, recent notes, subject progress → continues work. No data is invented if nothing was done — empty states say so.

### Admin
Logs in with an admin account (created by seed script / manual DB flag only — never by public self-registration) → Admin panel → creates curated subjects + sample quiz banks → views aggregate counts only (total users, total courses, total quiz attempts — no private notes, no per-user note content).

### Failure journeys (must be handled, not hidden)
- Wrong password → clear error, rate-limited after repeated failures.
- Database down → clear "Database unavailable, try again" error, never false success.
- Render backend asleep (15 min idle) → first load shows loading state, wakes in ~1 minute.
- Offline → clear offline state, no silent data loss; autosave shows error state.

---

## 4. Page map

**Public:** `/` (landing), `/login`, `/register`
**Protected (student):**
- `/dashboard`
- `/courses` + `/courses/:id`
- `/notes` + `/notes/:id`
- `/planner` (tasks, calendar + list)
- `/quizzes` + `/quizzes/:id` + `/quizzes/:id/attempt`
- `/flashcards` + `/flashcards/:deckId/review`
- `/pomodoro`
- `/gpa`
- `/analytics`
- `/settings`
**Protected (admin only):** `/admin` (curated subjects, sample quizzes, aggregate counts)
**Shared:** 404 page, loading / error / empty states on every page.

**Layout:** Desktop sidebar + topbar; mobile bottom navigation or accessible collapsible drawer. Light/dark mode on all pages. Keyboard navigation + accessible labels on all pages. 8px spacing scale, indigo / blue / violet accent, clean typography, generous spacing, subtle motion — professional SaaS, no excessive neon.

---

## 5. Data schema (MongoDB / Mongoose)

Every user-owned document has `userId`. Every read/write enforces ownership server-side — never trust `role` or `userId` supplied by the client.

| Collection | Key fields | Indexes |
|---|---|---|
| `users` | name, email (unique), passwordHash (bcrypt), role: `student` \| `admin`, theme, timezone, gradingScale, createdAt | email unique |
| `courses` | userId, title, code?, semester, colour, creditHours?, archived, createdAt | userId + archived, userId + semester |
| `notes` | userId, courseId?, title, contentMarkdown, tags[], pinned, archived, updatedAt | userId + updatedAt, userId + courseId, text search on title/content |
| `tasks` | userId, courseId?, title, description?, dueDate (UTC), priority: low/medium/high, completed, completedAt | userId + dueDate, userId + completed |
| `quizzes` | userId (or adminId for curated), courseId?, title, description?, isCurated, questions[] { question, options[4], correctIndex, explanation? }, timeLimitSec?, createdAt | userId, isCurated |
| `quizAttempts` | userId, quizId, answers[], score, total, startedAt, finishedAt | userId + quizId, userId + finishedAt |
| `flashcardDecks` | userId, courseId?, title, description? | userId |
| `flashcards` | deckId, userId, front, back | deckId |
| `flashcardReviews` | userId, flashcardId, easeFactor, intervalDays, repetitions, nextReviewAt, lastReviewedAt | userId + nextReviewAt |
| `studySessions` | userId, courseId?, type: pomodoro / focus, durationSec, startedAt, finishedAt, completed (bool) | userId + finishedAt |
| `gpaRecords` | userId, courseId?, courseTitle, creditHours, grade (letter), gradePoint, semester | userId + semester |
| `curatedSubjects` | title, description?, colour, createdByAdminId | title |

**Validation:** Zod / Joi on server + client validation. Sanitise / escape user content, safe Markdown rendering (no raw HTML injection), prevent Mongo query injection (never pass raw user objects as query operators).

---

## 6. Spaced repetition (documented simple algorithm — SM-2 simplified)

For each flashcard review, the user marks: Again / Hard / Good / Easy.
- Again: interval = 1 day, repetitions reset to 0.
- Hard: interval = max(1, interval × 1.2) days.
- Good: interval = interval × 2.5 days (first Good after new card = 1 day, second = 3 days).
- Easy: interval = interval × 3.5 days.
- `nextReviewAt = lastReviewedAt + intervalDays`. Review queue = cards where `nextReviewAt <= now`, ordered by oldest first.
- This is a simple, documented algorithm — NOT a claim of full SM-2 / Anki equivalence. It will be stated as such in the app and README.

---

## 7. Endpoint plan — REST `/api/v1`

Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password`
Health: `GET /api/health` (no secrets, returns status + DB connectivity only)
Courses: `GET /courses`, `POST /courses`, `GET /courses/:id`, `PUT /courses/:id`, `DELETE /courses/:id`
Notes: `GET /notes` (search, filter, pagination), `POST /notes`, `GET /notes/:id`, `PUT /notes/:id`, `DELETE /notes/:id`
Tasks: `GET /tasks`, `POST /tasks`, `PUT /tasks/:id`, `DELETE /tasks/:id`
Quizzes: `GET /quizzes`, `POST /quizzes`, `GET /quizzes/:id`, `PUT /quizzes/:id`, `DELETE /quizzes/:id`, `POST /quizzes/:id/attempts`, `GET /quizzes/:id/attempts`
Flashcards: `GET /flashcard-decks`, `POST /flashcard-decks`, `GET /flashcard-decks/:id/cards`, `POST /flashcard-decks/:id/cards`, `POST /flashcards/:id/review`
Sessions: `POST /study-sessions`, `GET /study-sessions`
GPA: `GET /gpa-records`, `POST /gpa-records`, `PUT /gpa-records/:id`, `DELETE /gpa-records/:id`, `GET /gpa/calculate`
Analytics: `GET /analytics/overview?from=&to=`
Settings / export: `GET /settings/export` (JSON / CSV), `DELETE /settings/account`
Admin: `GET /admin/subjects`, `POST /admin/subjects`, `PUT /admin/subjects/:id`, `DELETE /admin/subjects/:id`, `GET /admin/stats` (aggregate counts only)

**Cross-cutting:** Auth middleware on all protected routes, role check on `/admin/*`, rate limiting (esp. auth), Helmet, CORS allowlist (Vercel frontend origin only in production), centralised error handling, structured logs, pagination + indexes on list endpoints.

---

## 8. Repository layout (Phase 1)

```
/client  (Vite React app)
/server  (Express API)
/docs    (architecture, setup, API contract, test checklist)
/.github/workflows  (CI)
README.md
.gitignore
.env.example  (placeholders only — never real secrets)
```

**Tooling:** ESLint, Vitest / Jest for unit + integration tests, GitHub Actions CI (install, lint, build, test on every push). Sample data seed script (local only, clearly marked sample data).

---

## 9. Free-tier feasibility — verified 2026-11-11

Checked against vendor docs / pricing pages as summarised in web search on 2026-11-11. Limits change — re-check at deploy time in Phase 1.

### MongoDB Atlas — Free cluster (formerly M0)
- **Cost:** $0, free-forever.
- **Limits:** 512 MB storage (documents + indexes), shared RAM / vCPU, up to 100 operations/sec, up to 500 connections, 10 GB in + 10 GB out per rolling 7 days, 1 free cluster per Atlas project, max 100 databases / 500 collections, MongoDB 8.0, **no backups**.
- **Sleep rule:** Atlas pauses a free cluster after **30 days with zero connections**. Resume from Atlas dashboard.
- **Verdict for StudyMind:** Fits MVP easily. Notes / tasks / quizzes are small text documents; 512 MB is plenty for a portfolio project with a handful of users. Risk: if the cluster pauses after 30 idle days, first login after that will fail until resumed — handle with a clear error + resume step in README. No credit card required for Free cluster (verify at signup — if Atlas asks for a card, STOP and report, do not enter one).

### Render — Free web service (backend)
- **Cost:** $0.
- **Limits:** 512 MB RAM, 0.1 CPU, **spins down after 15 minutes without inbound traffic, ~1 minute to wake** on next request. 750 free instance hours / workspace / month (covers ~1 service running 24/7, since a month is ~720–744 h). 100 GB bandwidth / month, 500 build minutes / month, single instance only, **no persistent disk** (files written at runtime vanish on redeploy / spin-down), no shell, outbound SMTP blocked (ports 25/465/587).
- **Verdict for StudyMind:** Fits MVP, with the known cold-start cost. First request after idle takes ~1 min — the frontend must show a loading state, not an error. **Never store uploaded files on Render disk** (per master prompt). One free service only — do not add a second free service in the same workspace or the 750 h pool will run out.
- **Note:** Render's free Postgres expires (30–90 days per docs summaries) — **not used**. Database is Atlas, not Render Postgres.

### Vercel — Hobby plan (frontend)
- **Cost:** $0.
- **Eligibility:** Personal, **non-commercial use only**. All commercial use requires Pro ($20/month). StudyMind as a personal portfolio / student project qualifies; if it ever becomes commercial (ads, selling, paid client work), it must move to Pro. This must be stated in the README.
- **Limits:** 100 GB Fast Data Transfer / month, 1,000,000 CDN requests / month, 1,000,000 function invocations / month, 4 hours Active CPU / month, 360 GB-hours provisioned memory, 100 deployments / day, 45 min max build time, 200 projects / account, 1 developer seat.
- **If exceeded:** Feature pauses — in most cases you wait up to 30 days, you **cannot buy extra usage** on Hobby.
- **Verdict for StudyMind:** Fits easily. Frontend is a static Vite build, so bandwidth / function usage will be far below limits for a portfolio project.

### Total cost
**PKR 0 / $0 per month** on the above tiers, provided usage stays inside the limits above and no paid add-on is enabled. No credit card should be required for any of the three free tiers — if any signup asks for a card, STOP and report to Muzammil before entering anything.

---

## 10. Deployment risks

| Risk | Impact | Mitigation |
|---|---|---|
| Render sleeps after 15 min idle | First load slow (~1 min), user may think app is broken | Loading state + "waking up server" message; document in README; do NOT use a pinger to fake traffic (against free-tier spirit, and wastes hours) |
| Atlas pauses after 30 days idle | Login / API fails until resumed | Clear error message; resume step in README; keep a monthly check if the project goes quiet |
| Atlas 512 MB cap | App stops writing if filled | Text-only MVP, no file uploads; monitor size; pagination; no sample-data bloat in production |
| Vercel Hobby non-commercial rule | Account / project could be flagged if used commercially | Portfolio / personal use only, stated in README; move to Pro only if Muzammil decides to commercialise |
| Vercel Hobby limit exceeded | Feature paused up to 30 days | Static frontend, low traffic — unlikely; monitor usage in Vercel dashboard |
| Free-tier changes | Vendor changes limits / ends free tier | Re-check limits at Phase 1 deploy; keep code portable (standard Express + Mongoose, no vendor lock-in) |
| Secrets leaked | DB / accounts compromised | `.env` never committed, `.env.example` placeholders only, secrets only in Render / Vercel dashboard env vars |
| No Atlas backups on Free | Data loss if cluster deleted | Export feature (JSON/CSV) in Settings; warn users this is a portfolio project, not a production backup service |
| Accounts not connected | Phase 1 cannot deploy automatically | Phase 1 stops and gives exact manual steps if GitHub / Render / Vercel / Atlas access is unavailable — never invent success |

---

## 11. Testing plan (per phase)

- **Unit tests:** GPA calculation, grading-scale conversion, spaced-repetition intervals, date / timezone handling, Pomodoro session completion (no double-count).
- **Integration tests:** Auth (register / login / wrong password / protected route without token), ownership (user A cannot read / edit user B's notes / courses), CRUD for courses / notes / tasks, quiz grading, admin role check (student cannot access admin endpoints).
- **Manual acceptance checklist:** Desktop + mobile, light + dark mode, keyboard navigation, empty / loading / error states, Render cold-start behaviour.
- **Each phase ends with a report:** files changed + commit hash, commands + actual output, routes tested pass/fail with evidence, live URLs if actually deployed, known issues, and the question "Approve next phase?"

---

## 12. Phase plan reminder

- **Phase 0 (this document):** Design + feasibility — STOP, report, wait for approval.
- **Phase 1:** Deployable skeleton — repo, client, server, MongoDB connection, env examples, health endpoint, basic navigation, CI. Deploy minimal frontend + backend, verify DB connectivity. If credentials / hosting access unavailable, stop + exact manual steps.
- **Phase 2:** Auth + ownership.
- **Phase 3:** Courses, notes, tasks.
- **Phase 4:** Quiz, flashcards, Pomodoro.
- **Phase 5:** GPA, analytics, settings, admin.
- **Phase 6:** Polish + QA, end-to-end test on deployed app.

**No code has been written yet. No repo, deployment, or account has been created in Phase 0.**

---

## End-of-Phase-0 report

1. **Files changed:** `docs/phase-0-design-feasibility.md` (this file) — new file, no commit yet (no repo exists).
2. **Commands executed:** Web searches to verify Atlas / Render / Vercel free-tier limits (2026-11-11). No build / deploy commands run.
3. **Routes / features tested:** None yet — Phase 0 is design only.
4. **Live URLs:** None yet.
5. **Known issues / remaining:** 6 open decisions in §2 (UI language, GPA scale, streak definition, Pomodoro defaults, curated subjects, repo name). Accounts (GitHub / Render / Vercel / Atlas) assumed NOT connected — to be confirmed in Phase 1.
6. **Explicit question: Approve next phase?**
