import mongoose from 'mongoose';

// A platform-curated subject (e.g. "Data Structures") managed by admins.
// Students can browse these; they are suggestions, not private user data.
// createdBy is the admin who added it (null when added by the seed script
// before any admin exists — the script always passes an admin, see
// scripts/seed-samples.js).
const curatedSubjectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    code: { type: String, trim: true, maxlength: 20, default: '' },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    category: { type: String, trim: true, maxlength: 60, default: 'Computer Science' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

curatedSubjectSchema.index({ title: 1 });

export const CuratedSubject =
  mongoose.models.CuratedSubject || mongoose.model('CuratedSubject', curatedSubjectSchema);
export default CuratedSubject;
