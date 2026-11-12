import 'dotenv/config';
import { createApp } from './app.js';
import { connectDb } from './db.js';
import { getJwtSecret } from './auth.js';

// Fail loudly in production without a real JWT secret. In development a
// dev-only default is used with a warning (see auth.js) — never in prod.
try {
  getJwtSecret();
} catch (err) {
  console.error(`[auth] ${err.message}`);
  process.exit(1);
}

const PORT = Number(process.env.PORT || 5000);
const app = createApp();

// Connect to MongoDB in the background — a failed/missing DB must not
// prevent the server from starting (health endpoint reports it instead).
connectDb(process.env.MONGODB_URI).catch((err) => {
  console.error('[db] Unexpected connection error:', err.message);
});

app.listen(PORT, () => {
  console.log(`[server] StudyMind API listening on http://localhost:${PORT}`);
  console.log('[server] Health check: GET /api/health');
});
