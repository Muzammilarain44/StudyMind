import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    code: { type: String, trim: true, maxlength: 20, default: '' },
    semester: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
    colour: {
      type: String,
      default: '#4F46E5',
      match: /^#[0-9a-fA-F]{6}$/,
    },
    creditHours: { type: Number, min: 0, max: 12 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

courseSchema.index({ userId: 1, archived: 1 });
courseSchema.index({ userId: 1, semester: 1 });

export const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);
export default Course;
