# StudyMind — Test Checklist (Phase 1)

## Automated (run before every commit)

- [ ] `cd server && npm test` — all tests pass (health 503-shape with DB down,
      `/api/v1/health` mirrors it, `/` text, auth placeholder 501).
- [ ] `cd server && npm run lint` — no syntax errors (`node --check`).
- [ ] `cd client && npm run lint` — ESLint passes.
- [ ] `cd client && npm run build` — Vite build passes, `dist/` is produced.
- [ ] GitHub Actions CI is green on the push/PR.

## Manual — local

### Backend
- [ ] `cd server && npm run dev` starts on port 5000 without a `.env` / DB.
- [ ] `curl http://localhost:5000/` returns `StudyMind API running`.
- [ ] `curl http://localhost:5000/api/health` returns 503 + `db: "disconnected"` (no DB).
- [ ] With a real `MONGODB_URI`: health returns 200 + `db: "connected"`.
- [ ] `curl -X POST http://localhost:5000/api/v1/auth/login` returns 501.
- [ ] `curl http://localhost:5000/api/unknown` returns 404 JSON.

### Frontend — desktop (Chrome, width ≥ 1024px)
- [ ] Home loads: hero, 4 feature cards, no console errors.
- [ ] Sidebar + topbar visible on Dashboard / Login / Register.
- [ ] Login page: form renders, submit button is disabled and says "coming in Phase 2".
- [ ] Register page: same — disabled button, no fake account creation.
- [ ] Dashboard with backend running: shows HTTP status, API status, DB status, timestamp.
- [ ] Dashboard with backend stopped: shows a clear "Could not reach the API" error, not a blank page.
- [ ] Dark mode toggle works and survives a page reload (localStorage).
- [ ] Unknown route (e.g. `/nope`) shows the "Page not found" page.
- [ ] Keyboard: Tab reaches all links, buttons and inputs in a sensible order.

### Frontend — mobile (width ~390px)
- [ ] Topbar fits, no horizontal scrolling.
- [ ] Bottom navigation is visible and tappable; sidebar is hidden.
- [ ] Hero text and feature cards stack vertically and stay readable.
- [ ] Forms are usable with the on-screen keyboard; inputs are not covered by the bottom nav.
- [ ] Dark mode toggle is reachable.

### Deployed (only after local checks pass)
- [ ] Render health URL returns 200 + `db: "connected"`.
- [ ] Vercel site loads; Dashboard shows the live Render health status.
- [ ] After 15+ minutes idle, the first Dashboard load shows the loading state and
      then recovers (Render cold start ~1 minute) — record the actual time.
- [ ] No secrets appear in any response, log or committed file.
