# StudyMind — Setup (Phase 5)

## Prerequisites

- Node.js 20+ and npm
- Git
- (Optional, for a real database) A free MongoDB Atlas account + Free cluster.
  No database is needed to run the Phase 1 skeleton.

## Local setup

```bash
git clone https://github.com/Muzammilarain44/StudyMind.git
cd StudyMind

# Backend
cd server
npm install
cp .env.example .env        # optional; only needed for a real MongoDB connection
npm run dev                 # http://localhost:5000

# Frontend (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Open http://localhost:5173 — Home, Login, Register and Dashboard should all load.
After logging in, Courses, Notes, Planner, Quizzes, Flashcards, Pomodoro, GPA,
Analytics and Settings are available; the Dashboard shows real metrics
calculated from your own data.

## Environment variables

Copy the `.env.example` files and fill in your own values. Never commit a real `.env`.

| File | Variable | Purpose |
|---|---|---|
| `server/.env` | `PORT` | Backend port (default 5000) |
| `server/.env` | `MONGODB_URI` | Atlas connection string (leave unset to run without a DB) |
| `server/.env` | `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated (default `http://localhost:5173`) |
| `server/.env` | `JWT_SECRET` | Long random secret for auth cookies (≥ 32 chars). Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Production refuses to start without it; dev uses a warned dev-only default. Never commit a real value. |
| `client/.env` | `VITE_API_URL` | Backend URL in production; leave unset in dev (Vite proxy) |

Auth, courses, notes and tasks all need a database: they return 503 while
MongoDB is down. For local testing without Atlas, the server test suite uses
an in-memory MongoDB (`mongodb-memory-server`, dev-only) — see
`server/test/phase5.test.js`. Phase 5 adds no new environment variables.

## Admin access and sample content (Phase 5)

There is **no admin self-registration**. To make a user an admin, they must
register first, then run (from `server/`, with `MONGODB_URI` in `server/.env`
or the environment):

```bash
cd server
node scripts/promote-admin.js admin@example.com
```

To seed the platform sample content (5 curated CS subjects and 2 sample quiz
banks, owned by that admin), run:

```bash
node scripts/seed-samples.js admin@example.com
```

The seed script is idempotent — running it again creates nothing new. Admins
manage subjects and samples from the Admin page (visible in the nav only for
admins); students can browse samples there and copy them into their own
quizzes.

## Deployment (manual steps — no live deployment exists yet)

### 1. MongoDB Atlas (Free cluster)

1. Create a free Atlas account and a Free cluster (512 MB, formerly M0).
2. Create a database user (username + strong password — keep it private).
3. Network Access: allow your IP (or `0.0.0.0/0` for Render — understand the trade-off).
4. Copy the connection string into the Render env var `MONGODB_URI`.
5. Note: a Free cluster pauses after 30 days with zero connections; resume it in Atlas.

### 2. Render — backend (Free web service)

1. New → Web Service → connect the GitHub repo, root directory `server`.
2. Build command: `npm install`. Start command: `npm start`.
3. Environment: `PORT` is set by Render; add `MONGODB_URI`,
   `CORS_ORIGIN=https://<your-vercel-app>.vercel.app` and a generated
   `JWT_SECRET` (long random string — without it the server exits in production).
4. Free tier sleeps after 15 minutes idle and takes ~1 minute to wake — expected.
5. Verify: `curl https://<your-render-app>.onrender.com/api/health` → 200 + `db: "connected"`.

### 3. Vercel — frontend (Hobby, $0, non-commercial only)

1. Import the GitHub repo, root directory `client`, framework preset Vite.
2. Environment variable: `VITE_API_URL=https://<your-render-app>.onrender.com`.
3. Deploy and open the site; the Dashboard should show the live API health.
4. If the backend was asleep, the first Dashboard load may take ~1 minute.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Dashboard: "Could not reach the API" | Backend not running — start `server` first; check the port. |
| Health returns 503, `db: "disconnected"` | No / unreachable MongoDB — check `MONGODB_URI`, Atlas user, Network Access. The API itself is fine. |
| CORS error in the browser | `CORS_ORIGIN` does not include the frontend origin — fix the env var and restart. |
| First load after idle is very slow | Render free tier waking up (~1 min) — expected, not a bug. |
| `npm ci` fails in CI | Lockfiles must be committed — do not delete `package-lock.json`. |
