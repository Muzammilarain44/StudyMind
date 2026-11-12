# StudyMind — Test Checklist (Phase 4)

## Automated (run before every commit)

- [ ] `cd server && npm test` — all tests pass (4 health + 9 auth + 14 Phase 3
      + 17 Phase 4: quiz CRUD/grading/stats, flashcard decks/cards/reviews/SRS
      intervals, Pomodoro start/complete/idempotency, ownership 404s,
      validation 400s, dashboard streak/focus/quiz math).
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
- [ ] `curl -X POST http://localhost:5000/api/v1/auth/login` with no DB returns 503.
- [ ] `curl http://localhost:5000/api/unknown` returns 404 JSON.
- [ ] With a DB: register → create course → create note → create task → complete task → `GET /api/v1/dashboard` numbers match the data created.
- [ ] With a DB: create a quiz (2 questions) → submit an attempt (1 right, 1 wrong) → score is 1/2 with explanations; create a deck + card → review "good" → nextDue is ~3 days out and the card leaves the due queue; start a Pomodoro session → same clientKey returns the same session → complete it → completing again is 409 → dashboard streak is ≥ 1.
- [ ] A second user's cookie on the first user's quiz/deck/card/session returns 404.
- [ ] `GET /api/v1/quizzes` without a cookie returns 401.

### Frontend — desktop (Chrome, width ≥ 1024px)
- [ ] Home loads: hero, 4 feature cards, no console errors.
- [ ] Sidebar + topbar visible on Dashboard / Login / Register.
- [ ] Login page: real login works and redirects to the Dashboard.
- [ ] Courses: create/edit/archive/delete work; search and semester filter work; empty state shows when there are no courses.
- [ ] Notes: create, edit with autosave ("Saving… / ✓ Saved"), Markdown preview renders headings/lists, search/tag/pin filters work.
- [ ] Planner: create/edit/complete/delete tasks; overdue tasks highlighted; month calendar shows task counts and day-click filters the list.
- [ ] Dashboard with data: stat cards, next tasks, recent notes and per-course progress bars match the stored data; empty states are honest when there is no data.
- [ ] Quizzes: create a quiz with 2 questions and a timer, take it, submit with 1 right / 1 wrong, result shows 1/2 with explanations and the attempt appears in history; stats show the attempt.
- [ ] Flashcards: create a deck and a card, study it (click to flip), rate it "good" — the card leaves the due queue; a new card is due immediately.
- [ ] Pomodoro: start a focus session, pause and resume, finish it — it appears in history and the dashboard focus minutes increase; refreshing the page mid-session resumes the same session instead of starting a duplicate.
- [ ] Dashboard shows the study streak, focus minutes today and quiz totals from real data; empty states are honest when there is no data.
- [ ] Dashboard with backend stopped: shows a clear "Could not load the dashboard" error, not a blank page.
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
