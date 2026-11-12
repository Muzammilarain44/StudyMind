import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { dbStatus } from './db.js';
import authRouter from './routes/auth.js';
import coursesRouter from './routes/courses.js';
import notesRouter from './routes/notes.js';
import tasksRouter from './routes/tasks.js';
import dashboardRouter from './routes/dashboard.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // CORS allowlist from env (comma-separated). Credentials enabled so the
  // browser sends the HttpOnly auth cookie cross-origin (Vercel -> Render).
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / non-browser requests with no Origin header.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
      credentials: true,
    }),
  );

  // General API rate limit (auth has its own tighter limiter below).
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api', apiLimiter);

  const healthPayload = () => ({
    status: dbStatus() === 'connected' ? 'ok' : 'degraded',
    db: dbStatus(),
    timestamp: new Date().toISOString(),
  });

  // Health endpoints — must never crash when MongoDB is down.
  // Connected: 200. Disconnected: 503 with db: "disconnected".
  const healthHandler = (req, res) => {
    const payload = healthPayload();
    res.status(payload.db === 'connected' ? 200 : 503).json(payload);
  };
  app.get('/api/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  app.get('/', (req, res) => {
    res.type('text').send('StudyMind API running');
  });

  // Auth — Phase 2. The tight register/login limiter lives in routes/auth.js
  // (10 per 15 min / IP); /me, /logout and /change-password are session-gated.
  app.use('/api/v1/auth', authRouter);

  // Courses, notes, tasks, dashboard — Phase 3. All behind requireAuth
  // (applied inside each router) with server-side ownership checks.
  app.use('/api/v1/courses', coursesRouter);
  app.use('/api/v1/notes', notesRouter);
  app.use('/api/v1/tasks', tasksRouter);
  app.use('/api/v1/dashboard', dashboardRouter);

  // 404 for unknown API routes
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Central error handler (never leaks stack traces / secrets in production)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[error]', err.message);
    if (err.message && err.message.startsWith('Origin not allowed by CORS')) {
      return res.status(403).json({ error: 'Origin not allowed by CORS.' });
    }
    // A malformed ObjectId in the URL is "not found", not a server error.
    if (err.name === 'CastError') {
      return res.status(404).json({ error: 'Not found.' });
    }
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

export default createApp;
