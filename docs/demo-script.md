# StudyMind — Demo Script (Phase 6)

A click-by-click tour of the finished app. Each step states what to click
and what you should see. All data is your own — nothing is faked. The demo
was verified end-to-end in a real browser against the built client + a real
server (see `docs/test-checklist.md`, "Local end-to-end (browser)").

**Setup:** start the backend (`cd server && npm run dev`) and the frontend
(`cd client && npm run dev`), then open http://localhost:5173. Use a fresh
account so the numbers below match.

## 1. Register and land on the Dashboard (1 minute)

1. Click **Register**. Enter name "Demo Student", any email, password (8+
   characters). Click **Create account**.
2. You land on the **Dashboard**. It is empty and says so honestly:
   "Nothing here yet — and that is honest". No fake numbers.

## 2. Add a course (1 minute)

1. Open **Courses**. Title "Database Systems", Semester "Fall 2026",
   Credit hours 3. Click **Add course**.
2. The course card appears with a colour dot, semester and "3 credit hours".

## 3. Write a note with autosave (1 minute)

1. Open **Notes**. Click **+ New note**.
2. Title "Chapter 1 notes", content:
   `# Databases` (new line) `- Tables store rows`.
3. Stop typing — after about a second the status reads **✓ Saved**.
4. Click **Preview** — the heading and list render formatted (safe Markdown).

## 4. Plan a task (1 minute)

1. Open **Planner**. Title "Read chapter 4", due date any future date.
   Click **Add task**.
2. The task appears in the list and on the month calendar (day shows "1 task").
3. Tick its checkbox — it is marked done (struck through).

## 5. Build and take a quiz (2 minutes)

1. Open **Quizzes**. Title "DB Basics". Question "What does CPU stand
   for?", options "Central Processing Unit", "Computer Personal Unit",
   "Central Program Utility", "Central Processor Unit" — correct option A.
   Click **Add question**, then **Create quiz**.
2. Click **Take quiz**, pick "Central Processing Unit", click **Submit**.
3. Result: **Score: 1 / 1 (100%)** with the correct answer shown, and the
   attempt appears in **Attempt history**. Stats update to 1 attempt, 100%.

## 6. Study flashcards (2 minutes)

1. Open **Flashcards**. Title "OS Terms". Click **Create deck**.
2. Front "What is a process?", Back "A program in execution." Click
   **Add card**.
3. Click **Study now** → "Card 1 of 1". Click the card to flip it, then rate
   it **Good**.
4. **"Queue clear — 1 card reviewed."** The card is scheduled a few days
   out (spaced repetition, SM-2-lite — see `docs/architecture.md`).

## 7. Pomodoro (1 minute)

1. Open **Pomodoro**. Set **Focus minutes** to 1. Click **Start focus
   (1 min)** — the timer counts down from 01:00.
2. Click **Finish now** — a break starts automatically. Click **Give up**
   to end the break.
3. **Session history** shows the finished focus session; the Dashboard's
   "Focus today" reads 1 min and the **study streak** reads 1 day.

## 8. GPA (1 minute)

1. Open **GPA**. Title "Mathematics", Semester "Fall 2026", Grade A,
   Credit hours 3. Click **Add record**.
2. **Your GPA (estimate): 4.00** — 3 credit hours, 1 record, 4.0 scale.
   (Add a B at 3 credits and it becomes 3.50 — see `docs/test-checklist.md`.)

## 9. Analytics (1 minute)

1. Open **Analytics**. The totals read Focus minutes 1, Focus sessions 1,
   Tasks completed 1, Quiz attempts 1, Avg quiz score 100%.
2. Three charts render from that same data (focus per day, tasks + attempts
   per day, average score per day) plus a per-course breakdown table.
3. Change the date range to a future month and click **Apply** — the honest
   empty state appears ("No study data in this range yet").

## 10. Settings, dark mode, export (2 minutes)

1. Open **Settings**. Theme → **Dark**, click **Save preferences** — the
   whole app turns dark immediately.
2. Open **Profile** — Theme already reads "dark" with **no page reload**.
3. Back in **Settings**, click **Download JSON** — the file contains only
   your own courses, notes, tasks, quizzes, flashcards, sessions and GPA
   records.
4. Switch back to Light with the **☀️ Light** button in the top bar.

## 11. Admin (optional, needs a promoted admin)

1. Promote the account first: `cd server && node scripts/promote-admin.js <email>`.
2. Open **Admin** — usage counts (users, courses, notes… counts only),
   curated subjects and sample quiz banks. Add a subject; as a student the
   same page shows samples to copy but no stats or edit buttons.

## 12. Log out

Click **Log out** (top bar, sidebar or Profile) — you return to the Login
page. Your data stays in the database for the next login.

## If something looks wrong

- Dashboard error box instead of numbers → the backend is not running or
  MongoDB is down; check `curl http://localhost:5000/api/health`.
- First load after idle is slow on Render → the free tier is waking up
  (~1 minute), expected.
- Anything else → see `docs/test-checklist.md` (manual checklist) and
  `docs/setup.md` (troubleshooting table).
