import mongoose from 'mongoose';

// One spaced-repetition review of a flashcard. intervalDays is the
// interval the SM-2-lite algorithm assigned after this review and nextDue
// is when the card becomes due again. The latest review per card decides
// whether the card is due (see server/src/srs.js).
const flashcardReviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flashcard', required: true, index: true },
    deckId: { type: mongoose.Schema.Types.ObjectId, ref: 'FlashcardDeck', required: true, index: true },
    rating: { type: String, required: true, enum: ['again', 'hard', 'good', 'easy'] },
    intervalDays: { type: Number, required: true, min: 1 },
    nextDue: { type: Date, required: true, index: true },
    reviewedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

flashcardReviewSchema.index({ userId: 1, cardId: 1, reviewedAt: -1 });
flashcardReviewSchema.index({ userId: 1, nextDue: 1 });

export const FlashcardReview =
  mongoose.models.FlashcardReview || mongoose.model('FlashcardReview', flashcardReviewSchema);
export default FlashcardReview;
