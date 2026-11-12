import mongoose from 'mongoose';
import { GRADE_LETTERS } from '../gpa.js';

// One saved grade for GPA calculation. Either a course (whose credit hours
// are copied onto the record at creation) or explicit credit hours must be
// present — a grade with no credits cannot be weighted. The grade letter is
// resolved to points through the owner's grading scale at compute time, so
// changing the scale re-computes the GPA without editing records.
const gpaRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    semester: { type: String, trim: true, maxlength: 60, default: '' },
    grade: { type: String, required: true, enum: GRADE_LETTERS },
    creditHours: { type: Number, required: true, min: 0, max: 12 },
  },
  { timestamps: true },
);

gpaRecordSchema.index({ userId: 1, semester: 1 });
gpaRecordSchema.index({ userId: 1, courseId: 1 });

export const GpaRecord =
  mongoose.models.GpaRecord || mongoose.model('GpaRecord', gpaRecordSchema);
export default GpaRecord;
