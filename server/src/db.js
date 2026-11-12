import mongoose from 'mongoose';

/**
 * Connect to MongoDB if MONGODB_URI is set.
 * Never crashes the process when the DB is down or the URI is missing —
 * the API stays up and /api/health reports db: "disconnected" (HTTP 503).
 * No URI is ever logged (it may contain credentials).
 */
export async function connectDb(uri) {
  if (!uri) {
    console.warn('[db] MONGODB_URI is not set — running without a database connection.');
    return false;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('[db] Connected to MongoDB.');
    return true;
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    return false;
  }
}

export function dbStatus() {
  // mongoose.connection.readyState: 1 = connected, anything else = not connected
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}

export default mongoose;
