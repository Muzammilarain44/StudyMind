import mongoose from 'mongoose';

const flashcardDeckSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  },
  { timestamps: true },
);

flashcardDeckSchema.index({ userId: 1, courseId: 1 });

export const FlashcardDeck =
  mongoose.models.FlashcardDeck || mongoose.model('FlashcardDeck', flashcardDeckSchema);
export default FlashcardDeck;
