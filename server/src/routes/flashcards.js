import express from 'express';
import { z } from 'zod';
import { FlashcardDeck } from '../models/FlashcardDeck.js';
import { Flashcard } from '../models/Flashcard.js';
import { FlashcardReview } from '../models/FlashcardReview.js';
import { requireAuth } from '../middleware/auth.js';
import { SRS_RATINGS, nextDueDate, nextIntervalDays } from '../srs.js';
import {
  isObjectId,
  pagedResponse,
  parseBody,
  parsePagination,
  requireDb,
  resolveCourseId,
} from './common.js';

const router = express.Router();

router.use(requireAuth, requireDb);

const deckSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120),
  description: z.string().trim().max(500).optional(),
  courseId: z.string().optional().nullable(),
});

const cardSchema = z.object({
  front: z.string().trim().min(1, 'The front of the card is required.').max(1000),
  back: z.string().trim().min(1, 'The back of the card is required.').max(2000),
});

const reviewSchema = z.object({
  rating: z.enum(SRS_RATINGS, { message: 'Rating must be again, hard, good or easy.' }),
});

/** Load a deck owned by the user, or send 404 and return null. */
async function loadDeck(deckId, userId, res) {
  if (!isObjectId(deckId)) {
    res.status(404).json({ error: 'Deck not found.' });
    return null;
  }
  const deck = await FlashcardDeck.findOne({ _id: deckId, userId });
  if (!deck) {
    res.status(404).json({ error: 'Deck not found.' });
    return null;
  }
  return deck;
}

/** Load a card owned by the user inside the given deck, or 404. */
async function loadCard(deck, cardId, userId, res) {
  if (!isObjectId(cardId)) {
    res.status(404).json({ error: 'Card not found.' });
    return null;
  }
  const card = await Flashcard.findOne({ _id: cardId, deckId: deck._id, userId });
  if (!card) {
    res.status(404).json({ error: 'Card not found.' });
    return null;
  }
  return card;
}

/** The latest review for each card in a deck, as a Map keyed by card id. */
async function latestReviewsByCard(userId, deckId) {
  const reviews = await FlashcardReview.find({ userId, deckId }).sort({ reviewedAt: -1 }).lean();
  const map = new Map();
  for (const r of reviews) {
    const key = String(r.cardId);
    if (!map.has(key)) map.set(key, r);
  }
  return map;
}

// ---- Decks ----

// GET /api/v1/flashcard-decks — list own decks with card counts.
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const filter = { userId: req.user._id };
    if (req.query.courseId) {
      if (!isObjectId(req.query.courseId)) {
        return res.status(400).json({ error: 'courseId is not a valid course.' });
      }
      filter.courseId = req.query.courseId;
    }
    const [decks, total] = await Promise.all([
      FlashcardDeck.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      FlashcardDeck.countDocuments(filter),
    ]);
    const counts = await Flashcard.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: '$deckId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    const items = decks.map((d) => ({ ...d, cardCount: countMap.get(String(d._id)) || 0 }));
    return res.json(pagedResponse(items, 'decks', total, { page, limit }));
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/flashcard-decks
router.post('/', async (req, res, next) => {
  try {
    const data = parseBody(deckSchema, req, res);
    if (!data) return;
    const courseId = await resolveCourseId(data.courseId, req.user._id, res);
    if (courseId === undefined) return;
    const deck = await FlashcardDeck.create({ ...data, courseId, userId: req.user._id });
    return res.status(201).json({ deck });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/flashcard-decks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const deck = await loadDeck(req.params.id, req.user._id, res);
    if (!deck) return;
    const cardCount = await Flashcard.countDocuments({ deckId: deck._id, userId: req.user._id });
    return res.json({ deck: { ...deck.toObject(), cardCount } });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/v1/flashcard-decks/:id
router.put('/:id', async (req, res, next) => {
  try {
    const data = parseBody(deckSchema.partial(), req, res);
    if (!data) return;
    if (data.courseId !== undefined) {
      const courseId = await resolveCourseId(data.courseId, req.user._id, res);
      if (courseId === undefined) return;
      data.courseId = courseId;
    }
    const deck = await FlashcardDeck.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      data,
      { new: true, runValidators: true },
    );
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    return res.json({ deck });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/v1/flashcard-decks/:id — also deletes its cards and reviews.
router.delete('/:id', async (req, res, next) => {
  try {
    const deck = await FlashcardDeck.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!deck) return res.status(404).json({ error: 'Deck not found.' });
    await Flashcard.deleteMany({ deckId: deck._id, userId: req.user._id });
    await FlashcardReview.deleteMany({ deckId: deck._id, userId: req.user._id });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// ---- Cards ----

// GET /api/v1/flashcard-decks/:id/cards — list cards in a deck.
router.get('/:id/cards', async (req, res, next) => {
  try {
    const deck = await loadDeck(req.params.id, req.user._id, res);
    if (!deck) return;
    const { page, limit, skip } = parsePagination(req);
    const filter = { userId: req.user._id, deckId: deck._id };
    const [cards, total] = await Promise.all([
      Flashcard.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit),
      Flashcard.countDocuments(filter),
    ]);
    return res.json(pagedResponse(cards, 'cards', total, { page, limit }));
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/flashcard-decks/:id/cards
router.post('/:id/cards', async (req, res, next) => {
  try {
    const deck = await loadDeck(req.params.id, req.user._id, res);
    if (!deck) return;
    const data = parseBody(cardSchema, req, res);
    if (!data) return;
    const card = await Flashcard.create({ ...data, deckId: deck._id, userId: req.user._id });
    return res.status(201).json({ card });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/flashcard-decks/:id/due — the review queue, synced with the DB:
// cards never reviewed, or whose latest review's nextDue has passed.
// New cards first, then the most overdue.
router.get('/:id/due', async (req, res, next) => {
  try {
    const deck = await loadDeck(req.params.id, req.user._id, res);
    if (!deck) return;
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const cards = await Flashcard.find({ userId: req.user._id, deckId: deck._id })
      .sort({ createdAt: 1 })
      .lean();
    const latest = await latestReviewsByCard(req.user._id, deck._id);
    const now = new Date();
    const due = cards
      .map((card) => {
        const review = latest.get(String(card._id));
        return { card, review: review || null, due: !review || new Date(review.nextDue) <= now };
      })
      .filter((entry) => entry.due)
      .sort((a, b) => {
        if (!a.review && !b.review) return 0;
        if (!a.review) return -1;
        if (!b.review) return 1;
        return new Date(a.review.nextDue) - new Date(b.review.nextDue);
      })
      .slice(0, limit)
      .map(({ card, review }) => ({
        ...card,
        lastRating: review ? review.rating : null,
        lastIntervalDays: review ? review.intervalDays : null,
        nextDue: review ? review.nextDue : null,
      }));
    return res.json({ deckId: deck._id, dueCount: due.length, cards: due });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/v1/flashcard-decks/:id/cards/:cardId
router.put('/:id/cards/:cardId', async (req, res, next) => {
  try {
    const deck = await loadDeck(req.params.id, req.user._id, res);
    if (!deck) return;
    const data = parseBody(cardSchema.partial(), req, res);
    if (!data) return;
    const card = await Flashcard.findOneAndUpdate(
      { _id: req.params.cardId, deckId: deck._id, userId: req.user._id },
      data,
      { new: true, runValidators: true },
    );
    if (!card) return res.status(404).json({ error: 'Card not found.' });
    return res.json({ card });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/v1/flashcard-decks/:id/cards/:cardId — also deletes its reviews.
router.delete('/:id/cards/:cardId', async (req, res, next) => {
  try {
    const deck = await loadDeck(req.params.id, req.user._id, res);
    if (!deck) return;
    const card = await Flashcard.findOneAndDelete({
      _id: req.params.cardId,
      deckId: deck._id,
      userId: req.user._id,
    });
    if (!card) return res.status(404).json({ error: 'Card not found.' });
    await FlashcardReview.deleteMany({ cardId: card._id, userId: req.user._id });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// POST /api/v1/flashcard-decks/:id/cards/:cardId/review — rate a card after
// studying it. The SM-2-lite interval (server/src/srs.js) is computed from
// the card's previous interval and stored with the review, so the due queue
// always reflects the latest rating.
router.post('/:id/cards/:cardId/review', async (req, res, next) => {
  try {
    const deck = await loadDeck(req.params.id, req.user._id, res);
    if (!deck) return;
    const data = parseBody(reviewSchema, req, res);
    if (!data) return;
    const card = await loadCard(deck, req.params.cardId, req.user._id, res);
    if (!card) return;
    const latest = await FlashcardReview.findOne({ userId: req.user._id, cardId: card._id })
      .sort({ reviewedAt: -1 })
      .lean();
    const prevInterval = latest ? latest.intervalDays : 0;
    const intervalDays = nextIntervalDays(data.rating, prevInterval);
    const reviewedAt = new Date();
    const review = await FlashcardReview.create({
      userId: req.user._id,
      cardId: card._id,
      deckId: deck._id,
      rating: data.rating,
      intervalDays,
      nextDue: nextDueDate(data.rating, prevInterval, reviewedAt),
      reviewedAt,
    });
    return res.status(201).json({ review, card });
  } catch (err) {
    return next(err);
  }
});

// GET /api/v1/flashcard-decks/:id/cards/:cardId/reviews — review history.
router.get('/:id/cards/:cardId/reviews', async (req, res, next) => {
  try {
    const deck = await loadDeck(req.params.id, req.user._id, res);
    if (!deck) return;
    const card = await loadCard(deck, req.params.cardId, req.user._id, res);
    if (!card) return;
    const { page, limit, skip } = parsePagination(req);
    const filter = { userId: req.user._id, cardId: card._id };
    const [reviews, total] = await Promise.all([
      FlashcardReview.find(filter).sort({ reviewedAt: -1 }).skip(skip).limit(limit),
      FlashcardReview.countDocuments(filter),
    ]);
    return res.json(pagedResponse(reviews, 'reviews', total, { page, limit }));
  } catch (err) {
    return next(err);
  }
});

export default router;
