import mongoose from 'mongoose';

// One question inside a quiz. The options array holds 2–6 choices and
// correctIndex points at exactly one of them (validated in the route and
// by the questions-array validator on the quiz schema below).
const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 2 && v.length <= 6,
        message: 'Each question needs between 2 and 6 options.',
      },
    },
    correctIndex: { type: Number, required: true, min: 0 },
    explanation: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { _id: false },
);

const quizSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    // Optional attempt timer in seconds; null means no timer.
    timeLimitSeconds: { type: Number, min: 10, max: 14400, default: null },
    // True for platform sample quizzes created by an admin. Samples are
    // platform content: students browse and copy them, and they survive an
    // admin deleting their own account.
    isSample: { type: Boolean, default: false },
    questions: {
      type: [questionSchema],
      required: true,
      validate: {
        validator: (qs) =>
          Array.isArray(qs) &&
          qs.length >= 1 &&
          qs.length <= 100 &&
          qs.every((q) => q.correctIndex < q.options.length),
        message: 'A quiz needs 1–100 questions and correctIndex must point at an option.',
      },
    },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

quizSchema.index({ userId: 1, archived: 1 });
quizSchema.index({ userId: 1, courseId: 1 });

export const Quiz = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);
export default Quiz;
