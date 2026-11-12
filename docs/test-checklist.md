# StudyMind — Test Checklist (Phase 5)

## Automated (run before every commit)

- [ ] `cd server && npm test` — all tests pass (4 health + 9 auth + 14 Phase 3
      + 17 Phase 4 + 12 Phase 5: GPA compute/scale/validation/ownership,
      analytics totals/date filters, settings validation, export scoping,
      account deletion, admin 403s, subjects, sample quizzes, stats).
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
- [ ] With a DB: create 2 courses with credit hours → add GPA records (A + B, 3cr each) → `GET /api/v1/gpa-records/compute` is exactly 3.5 and labelled an estimate; change the scale (A = 5) → GPA changes accordingly.
- [ ] With a DB: complete a focus session + a task + a quiz attempt → `GET /api/v1/analytics/overview` totals match (focus minutes, tasks, attempts, average %); a future-only date range returns zeros.
- [ ] With a DB: export JSON and CSV → both contain only the logged-in user's data.
- [ ] With a DB: `node scripts/promote-admin.js <email>` promotes a user; as admin, create a curated subject and a sample quiz → a student sees them, cannot edit them, can copy the sample; `GET /api/v1/admin/stats` returns counts only.
- [ ] With a DB: delete an account with the wrong password → 401; with the right password → account and owned data are gone, old token returns 401.
- [ ] A second user's cookie on the first user's quiz/deck/card/session/GPA record returns 404.
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
- [ ] GPA: add two grades (A + B, 3 credits each) → GPA shows 3.50 with an "estimate" note and a per-semester breakdown; change the grading scale → GPA re-computes.
- [ ] Analytics: with study data, the three charts render real numbers; with no data in the selected range, an honest empty state shows; changing the date range updates the charts.
- [ ] Settings: change theme and timezone → saved; download JSON and CSV exports → files contain your data; delete-account asks for the password and a confirmation tick.
- [ ] Admin (as a promoted admin): stats cards show counts; add/edit/delete a curated subject; create a sample quiz; as a student, the Admin page shows samples to copy but no stats or edit buttons.
- [ ] Dark mode toggle works and survives a page reload (localStorage), and a theme saved in Settings survives a fresh login.
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
