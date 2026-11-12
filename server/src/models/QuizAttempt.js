import mongoose from 'mongoose';

// One graded attempt at a quiz. The answers are stored as option indexes
// (one per question, in order) so the attempt can be reviewed later; the
// score is computed server-side at submit time and never trusted from the
// client.
const quizAttemptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    answers: { type: [Number], required: true },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    timeTakenSeconds: { type: Number, min: 0, default: null },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

quizAttemptSchema.index({ userId: 1, quizId: 1, completedAt: -1 });
quizAttemptSchema.index({ userId: 1, completedAt: -1 });

export const QuizAttempt =
  mongoose.models.QuizAttempt || mongoose.model('QuizAttempt', quizAttemptSchema);
export default QuizAttempt;
