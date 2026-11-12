# StudyMind

A student learning workspace for university and college students: course organisation,
personal notes, study planning, MCQ quizzes, flashcards, Pomodoro sessions, GPA
calculation and progress analytics.

> **Honest status: Phase 5 — GPA, analytics, settings and admin are live.**
> Register, login, logout, session restore and password change work against a real
> MongoDB, with bcrypt-hashed passwords and HttpOnly-cookie JWT sessions. Courses
> (CRUD, semester, colour, archive), Markdown notes (autosave, search, tags, pin),
> tasks (due dates, priorities, complete toggle, calendar view) and a dashboard
> whose numbers are calculated from your own stored data all work. Phase 4 adds
> user-created MCQ quizzes (optional timer, server-side auto-grading, explanations,
> attempt history, per-course stats), flashcard decks with a flip animation and
> spaced repetition (SM-2-lite, due queue synced with the DB), and Pomodoro focus
> sessions (configurable durations, pause/resume, idempotent start so a tab refresh
> never double-counts) — plus a real study streak on the dashboard. Phase 5 adds
> a credit-weighted GPA calculator with a configurable grading scale (every result
> labelled an estimate), real analytics charts from stored data (focus minutes,
> tasks, quiz scores, per-course breakdown, date filters), settings (theme and
> timezone saved on the account, JSON/CSV export of your own data, password-
> confirmed account deletion) and an admin panel (server-verified role, curated
> subjects, sample quiz banks students can copy, aggregate usage counts only —
> no open admin self-registration). Only Phase 6 (polish & QA) remains.
> Nothing here is faked: no demo metrics, no fake charts.
>
> StudyMind is a portfolio project. It is **not** a generative-AI product: quiz
> questions and flashcards are created by users/admins. There is no LLM and no
> AI chatbot in the MVP.

## Stack

- Frontend: React 18 + Vite 5, React Router, Tailwind CSS 3, Recharts (analytics charts, code-split), JavaScript
- Backend: Node.js + Express 4, Mongoose, JavaScript
- Database: MongoDB (MongoDB Atlas Free cluster for deployment)
- CI: GitHub Actions (Node 20)

## Repository layout

```
/client            Vite React app
/server            Express API
/docs              Architecture, setup, API contract, test checklist
/.github/workflows CI
README.md
.gitignore
.env.example       Placeholders only — never real secrets
```

## Run locally

You need Node.js 20+ and npm. No database is required to start the skeleton —
the API runs without MongoDB and reports `db: "disconnected"` on the health endpoint.

### 1. Backend

```bash
cd server
npm install
cp .env.example .env   # optional; edit MONGODB_URI to connect a real database
npm run dev            # http://localhost:5000
```

Check it: `curl http://localhost:5000/api/health`

- With no database: HTTP 503, `{"status":"degraded","db":"disconnected","timestamp":"..."}`.
- With a reachable MongoDB: HTTP 200, `{"status":"ok","db":"connected","timestamp":"..."}`.

### 2. Frontend

```bash
cd client
npm install
npm run dev            # http://localhost:5173 (proxies /api to the backend)
```

Build it: `npm run build`. Lint it: `npm run lint`.

### Tests

```bash
cd server
npm test   # node:test — health (DB disconnected) + auth flow + courses/notes/tasks/dashboard, all against an in-memory MongoDB
```

## Environment variables

| Variable | Where | Example |
|---|---|---|
| `PORT` | server | `5000` |
| `MONGODB_URI` | server | `mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority` |
| `CORS_ORIGIN` | server | `http://localhost:5173` (comma-separated allowlist in production) |
| `JWT_SECRET` | server | Long random secret (≥ 32 chars). Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Production refuses to start without it. |
| `VITE_API_URL` | client | `http://localhost:5000` (leave unset in dev to use the Vite proxy) |

See `.env.example`, `server/.env.example` and `client/.env.example`.
Never commit a real `.env`, database password or token.

## Deployment (free tiers, PKR 0)

- **Frontend → Vercel (Hobby, $0).** Personal, non-commercial use only. 100 GB data
  transfer / month, 1M CDN requests / month. Set `VITE_API_URL` to the deployed backend URL.
- **Backend → Render (Free web service, $0).** 512 MB RAM. **Sleeps after 15 minutes
  without traffic and takes about a minute to wake** — the dashboard shows a loading
  state for this. 750 free instance hours / workspace / month. No persistent disk:
  never store uploaded files on Render.
- **Database → MongoDB Atlas (Free cluster, $0).** 512 MB storage, up to 100 ops/sec.
  **Pauses after 30 days with zero connections** — resume it from the Atlas dashboard.
  No backups on the Free tier.

No live URLs are claimed here — none exist yet. Deploy only after Phase 1 is verified
locally, and re-check the vendors' free-tier limits at deploy time; they change.

## Phases

- **Phase 0:** Design & feasibility — done (`docs/phase-0-design-feasibility.md`).
- **Phase 1:** Deployable skeleton — done.
- **Phase 2:** Auth & ownership — done.
- **Phase 3:** Courses, notes & tasks — done.
- **Phase 4:** Quiz, flashcards & Pomodoro — done.
- **Phase 5:** GPA, analytics, settings & admin — this repo state.
- **Phase 6:** Polish & QA, end-to-end test on the deployed app.

Each phase ends with a report (files changed, commands + output, tests pass/fail with
evidence, live URLs only if actually deployed, known issues) and the question
"Approve next phase?"
