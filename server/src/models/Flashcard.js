import mongoose from 'mongoose';

// One flashcard: a front (question / term) and a back (answer / definition).
// Review state lives in FlashcardReview, not here, so a card keeps its
// content even if its review history is deleted.
const flashcardSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deckId: { type: mongoose.Schema.Types.ObjectId, ref: 'FlashcardDeck', required: true, index: true },
    front: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
    back: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
  },
  { timestamps: true },
);

flashcardSchema.index({ userId: 1, deckId: 1 });

export const Flashcard =
  mongoose.models.Flashcard || mongoose.model('Flashcard', flashcardSchema);
export default Flashcard;
