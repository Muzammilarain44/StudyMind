import { useCallback, useEffect, useRef, useState } from 'react';
import { studySessionsApi } from '../lib/api.js';
import { btnDanger, btnGhost, btnPrimary, cardCls, inputCls, labelCls } from '../lib/ui-classes.js';

function makeClientKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatMs(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Pomodoro() {
  const [focusMinutes, setFocusMinutes] = useState(() => {
    const saved = Number(localStorage.getItem('studymind-pomodoro-focus'));
    return saved >= 1 && saved <= 240 ? saved : 25;
  });
  const [breakMinutes, setBreakMinutes] = useState(() => {
    const saved = Number(localStorage.getItem('studymind-pomodoro-break'));
    return saved >= 1 && saved <= 120 ? saved : 5;
  });
  const [phase, setPhase] = useState('idle'); // idle | focus | break | paused
  const [pausedType, setPausedType] = useState('focus');
  const [remainingMs, setRemainingMs] = useState(0);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const endAtRef = useRef(null);
  const sessionRef = useRef(null); // { id, type, plannedMinutes, startedAt }
  const breakMinutesRef = useRef(breakMinutes);
  breakMinutesRef.current = breakMinutes;

  useEffect(() => {
    localStorage.setItem('studymind-pomodoro-focus', String(focusMinutes));
  }, [focusMinutes]);
  useEffect(() => {
    localStorage.setItem('studymind-pomodoro-break', String(breakMinutes));
  }, [breakMinutes]);

  const loadData = useCallback(async () => {
    try {
      const [summaryData, historyData] = await Promise.all([
        studySessionsApi.summary(),
        studySessionsApi.list({ limit: 20 }),
      ]);
      setSummary(summaryData);
      setHistory(historyData.sessions);
    } catch (err) {
      setError(err.message || 'Could not load Pomodoro data.');
    }
  }, []);

  // On load: recover an active server session (e.g. after a tab refresh)
  // instead of starting a new one — this is what prevents double-counting.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadData();
      try {
        const active = await studySessionsApi.list({ status: 'active', limit: 1 });
        if (!cancelled && active.sessions.length > 0) {
          const s = active.sessions[0];
          const endAt = new Date(s.startedAt).getTime() + s.plannedMinutes * 60_000;
          const remaining = endAt - Date.now();
          if (remaining <= 0) {
            await studySessionsApi.complete(s._id, { actualMinutes: s.plannedMinutes });
            await loadData();
          } else {
            sessionRef.current = { id: s._id, type: s.type, plannedMinutes: s.plannedMinutes, startedAt: s.startedAt };
            endAtRef.current = endAt;
            setRemainingMs(remaining);
            setPhase(s.type);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not recover the active session.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const startSession = useCallback(async (type, plannedMinutes) => {
    setBusy(true);
    setError('');
    try {
      const data = await studySessionsApi.start({ type, plannedMinutes, clientKey: makeClientKey() });
      const s = data.session;
      sessionRef.current = { id: s._id, type: s.type, plannedMinutes: s.plannedMinutes, startedAt: s.startedAt };
      endAtRef.current = new Date(s.startedAt).getTime() + s.plannedMinutes * 60_000;
      setRemainingMs(s.plannedMinutes * 60_000);
      setPhase(s.type);
    } catch (err) {
      setError(err.message || 'Could not start the session.');
    } finally {
      setBusy(false);
    }
  }, []);

  const finishSession = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    sessionRef.current = null;
    endAtRef.current = null;
    try {
      await studySessionsApi.complete(current.id, { actualMinutes: current.plannedMinutes });
      if (current.type === 'focus') {
        // Focus done: start the break automatically.
        await startSession('break', breakMinutesRef.current);
      } else {
        setPhase('idle');
        setRemainingMs(0);
      }
      await loadData();
    } catch (err) {
      setError(err.message || 'Could not finish the session.');
      setPhase('idle');
    }
  }, [loadData, startSession]);
  const finishRef = useRef(finishSession);
  finishRef.current = finishSession;

  // Countdown tick while a session is running.
  useEffect(() => {
    if (phase !== 'focus' && phase !== 'break') return undefined;
    const id = setInterval(() => {
      const remaining = (endAtRef.current || Date.now()) - Date.now();
      if (remaining <= 0) {
        clearInterval(id);
        setRemainingMs(0);
        finishRef.current();
      } else {
        setRemainingMs(remaining);
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  function pause() {
    setPausedType(phase === 'break' ? 'break' : 'focus');
    setPhase('paused');
  }

  function resume() {
    endAtRef.current = Date.now() + remainingMs;
    setPhase(pausedType);
  }

  async function abandon() {
    const current = sessionRef.current;
    if (!current) return;
    setBusy(true);
    try {
      await studySessionsApi.abandon(current.id);
      sessionRef.current = null;
      endAtRef.current = null;
      setPhase('idle');
      setRemainingMs(0);
      await loadData();
    } catch (err) {
      setError(err.message || 'Could not abandon the session.');
    } finally {
      setBusy(false);
    }
  }

  const running = phase === 'focus' || phase === 'break' || phase === 'paused';
  const phaseLabel = phase === 'focus' ? 'Focus' : phase === 'break' ? 'Break' : phase === 'paused' ? `Paused (${pausedType})` : 'Ready';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pomodoro</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Focus in timed sessions with short breaks. A finished focus session counts toward your
          study streak. If the tab refreshes mid-session, the timer resumes from the saved
          session instead of starting a duplicate.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className={cardCls}>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Focus today</dt>
            <dd className="text-2xl font-bold">{summary.focusMinutesToday} min</dd>
          </div>
          <div className={cardCls}>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Focus sessions</dt>
            <dd className="text-2xl font-bold">{summary.completedFocusSessions}</dd>
          </div>
          <div className={cardCls}>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Total focus time</dt>
            <dd className="text-2xl font-bold">{summary.totalFocusMinutes} min</dd>
          </div>
          <div className={cardCls}>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Sessions today</dt>
            <dd className="text-2xl font-bold">{summary.focusSessionsToday}</dd>
          </div>
        </div>
      )}

      <section className={`${cardCls} space-y-4 text-center`} aria-label="Pomodoro timer">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{phaseLabel}</p>
        <p className="text-6xl font-bold tabular-nums" role="timer" aria-label={`Time remaining: ${formatMs(remainingMs)}`}>
          {formatMs(remainingMs)}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {running
            ? sessionRef.current
              ? `Session started ${new Date(sessionRef.current.startedAt).toLocaleTimeString()} · ${sessionRef.current.plannedMinutes} minutes planned`
              : 'Session in progress.'
            : 'Pick your durations below, then start a focus session.'}
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          {phase === 'idle' && (
            <>
              <button type="button" className={btnPrimary} disabled={busy} onClick={() => startSession('focus', focusMinutes)}>
                Start focus ({focusMinutes} min)
              </button>
              <button type="button" className={btnGhost} disabled={busy} onClick={() => startSession('break', breakMinutes)}>
                Start break ({breakMinutes} min)
              </button>
            </>
          )}
          {(phase === 'focus' || phase === 'break') && (
            <>
              <button type="button" className={btnPrimary} onClick={pause}>Pause</button>
              <button type="button" className={btnGhost} onClick={finishSession}>Finish now</button>
              <button type="button" className={btnDanger} disabled={busy} onClick={abandon}>Give up</button>
            </>
          )}
          {phase === 'paused' && (
            <>
              <button type="button" className={btnPrimary} onClick={resume}>Resume</button>
              <button type="button" className={btnDanger} disabled={busy} onClick={abandon}>Give up</button>
            </>
          )}
        </div>

        <div className="mx-auto grid max-w-md gap-4 pt-2 text-left sm:grid-cols-2">
          <div>
            <label htmlFor="focus-minutes" className={labelCls}>Focus minutes</label>
            <input
              id="focus-minutes"
              type="number"
              min="1"
              max="240"
              value={focusMinutes}
              disabled={running}
              onChange={(e) => setFocusMinutes(Math.max(1, Math.min(240, Number(e.target.value) || 25)))}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="break-minutes" className={labelCls}>Break minutes</label>
            <input
              id="break-minutes"
              type="number"
              min="1"
              max="120"
              value={breakMinutes}
              disabled={running}
              onChange={(e) => setBreakMinutes(Math.max(1, Math.min(120, Number(e.target.value) || 5)))}
              className={inputCls}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Defaults are 25 minutes of focus and a 5 minute break. Durations are saved on this device.
        </p>
      </section>

      <section className={cardCls} aria-label="Session history">
        <h2 className="font-semibold">Session history</h2>
        {loading ? (
          <p className="mt-2 text-sm text-slate-500">Loading sessions…</p>
        ) : history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            No sessions yet. Start a focus session above — finished sessions appear here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {history.map((s) => (
              <li key={s._id} className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-medium">
                  {s.type === 'focus' ? '🎯 Focus' : '☕ Break'} · {s.plannedMinutes} min planned
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  {s.status}
                  {s.actualMinutes !== null && s.actualMinutes !== undefined ? ` · ${s.actualMinutes} min` : ''}
                  {' · '}{new Date(s.startedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
