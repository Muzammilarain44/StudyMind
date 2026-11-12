import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    contentMarkdown: { type: String, default: '' },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (tags) => tags.length <= 10 && tags.every((t) => t.length <= 30),
        message: 'At most 10 tags, each at most 30 characters.',
      },
    },
    pinned: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

noteSchema.index({ userId: 1, updatedAt: -1 });
noteSchema.index({ userId: 1, courseId: 1 });
noteSchema.index({ title: 'text', contentMarkdown: 'text' });

export const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
export default Note;
