import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { dbStatus } from './db.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '100kb' }));

  // CORS allowlist from env (comma-separated). Default: Vite dev server only.
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
    }),
  );

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

  // Auth placeholder — Phase 2. Rate-limited, and explicitly NOT faked.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many auth requests, please try again later.' },
  });
  app.use('/api/v1/auth', authLimiter);
  app.all('/api/v1/auth/*', (req, res) => {
    res.status(501).json({ error: 'Auth is coming in Phase 2 — not implemented yet.' });
  });

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
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

export default createApp;
