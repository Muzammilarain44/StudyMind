import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import Courses from './pages/Courses.jsx';
import Notes from './pages/Notes.jsx';
import Planner from './pages/Planner.jsx';
import Quizzes from './pages/Quizzes.jsx';
import Flashcards from './pages/Flashcards.jsx';
import Pomodoro from './pages/Pomodoro.jsx';
import Gpa from './pages/Gpa.jsx';
import Settings from './pages/Settings.jsx';
import Admin from './pages/Admin.jsx';

// Analytics pulls in Recharts (~450 kB), so it is code-split: the charts
// chunk loads only when the Analytics page is visited.
const Analytics = lazy(() => import('./pages/Analytics.jsx'));

function NotFound() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        This page does not exist yet. Use the navigation above to go somewhere real.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/quizzes" element={<Quizzes />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/pomodoro" element={<Pomodoro />} />
          <Route path="/gpa" element={<Gpa />} />
          <Route
            path="/analytics"
            element={
              <Suspense fallback={<p className="text-sm text-slate-500">Loading analytics…</p>}>
                <Analytics />
              </Suspense>
            }
          />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
