# StudyMind

A student learning workspace for university and college students: course organisation,
personal notes, study planning, MCQ quizzes, flashcards, Pomodoro sessions, GPA
calculation and progress analytics.

> **Honest status: Phase 2 — auth is live.** Register, login, logout, session restore
> and password change work against a real MongoDB, with bcrypt-hashed passwords and
> HttpOnly-cookie JWT sessions. Courses, notes, quizzes, flashcards, Pomodoro, GPA and
> analytics are **not** built yet; they arrive in Phases 3–6. Nothing here is faked:
> the dashboard shows only the real API health status plus an honest empty state —
> no demo metrics, no fake charts.
>
> StudyMind is a portfolio project. It is **not** a generative-AI product: quiz
> questions and flashcards are created by users/admins. There is no LLM and no
> AI chatbot in the MVP.

## Stack

- Frontend: React 18 + Vite 5, React Router, Tailwind CSS 3, JavaScript
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
npm test   # node:test — health endpoint (DB disconnected) + full auth flow against an in-memory MongoDB
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
- **Phase 2:** Auth & ownership — this repo state.
- **Phase 3:** Courses, notes & tasks.
- **Phase 4:** Quiz, flashcards & Pomodoro.
- **Phase 5:** GPA, analytics, settings & admin.
- **Phase 6:** Polish & QA, end-to-end test on the deployed app.

Each phase ends with a report (files changed, commands + output, tests pass/fail with
evidence, live URLs only if actually deployed, known issues) and the question
"Approve next phase?"
