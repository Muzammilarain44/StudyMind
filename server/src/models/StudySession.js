import mongoose from 'mongoose';

// One Pomodoro focus or break session. A session is created once when the
// timer starts (status "active") and completed exactly once when the timer
// finishes or the user marks it done. clientKey is a client-generated
// idempotency key: starting the same session twice (e.g. a tab refresh
// re-sending the start request) returns the existing session instead of
// creating a duplicate, so focus time is never double-counted.
const studySessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, enum: ['focus', 'break'], default: 'focus' },
    plannedMinutes: { type: Number, required: true, min: 1, max: 240 },
    actualMinutes: { type: Number, min: 0, max: 240, default: null },
    status: {
      type: String,
      required: true,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
    },
    clientKey: { type: String, required: true, trim: true, maxlength: 100 },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One clientKey per user: the idempotency guarantee.
studySessionSchema.index({ userId: 1, clientKey: 1 }, { unique: true });
studySessionSchema.index({ userId: 1, status: 1, startedAt: -1 });
studySessionSchema.index({ userId: 1, type: 1, completedAt: -1 });

export const StudySession =
  mongoose.models.StudySession || mongoose.model('StudySession', studySessionSchema);
export default StudySession;
