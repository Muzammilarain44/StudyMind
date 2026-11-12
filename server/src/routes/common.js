import mongoose from 'mongoose';
import { Course } from '../models/Course.js';

/**
 * Shared helpers for the Phase 3 resource routers (courses, notes, tasks).
 * Every query enforces userId ownership server-side — the client-supplied
 * userId is never trusted (it is not even read from the request body).
 */

/** Answer 503 immediately when MongoDB is down instead of hanging. */
export function requireDb(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database unavailable. Please try again later.' });
  }
  return next();
}

/** Parse ?page & ?limit with sane defaults (page 1, limit 20, max 100). */
export function parsePagination(req) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function pagedResponse(items, key, total, { page, limit }) {
  return {
    [key]: items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Parse a query boolean ("true"/"false"), undefined when absent/invalid. */
export function parseBool(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/** True when the string is a syntactically valid Mongo ObjectId. */
export function isObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

/**
 * Validate an optional courseId from the body/query: it must be a valid
 * ObjectId and belong to the logged-in user. Returns the ObjectId (or null),
 * or sends a 400 and returns undefined when invalid.
 */
export async function resolveCourseId(courseId, userId, res) {
  if (courseId === undefined || courseId === null || courseId === '') return null;
  if (!isObjectId(courseId)) {
    res.status(400).json({ error: 'courseId is not a valid course.' });
    return undefined;
  }
  const course = await Course.findOne({ _id: courseId, userId });
  if (!course) {
    res.status(400).json({ error: 'courseId does not belong to your account.' });
    return undefined;
  }
  return course._id;
}

/** Run a Zod schema against req.body; on failure send 400 and return null. */
export function parseBody(schema, req, res) {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues[0]?.message || 'Invalid input.';
    res.status(400).json({ error: message });
    return null;
  }
  return result.data;
}

/** Escape user input for use inside a RegExp (search filters). */
export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
