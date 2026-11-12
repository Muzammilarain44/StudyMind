import mongoose from 'mongoose';

const gradingScaleSchema = new mongoose.Schema(
  {
    A: { type: Number, default: 4.0 },
    'A-': { type: Number, default: 3.7 },
    'B+': { type: Number, default: 3.3 },
    B: { type: Number, default: 3.0 },
    'B-': { type: Number, default: 2.7 },
    'C+': { type: Number, default: 2.3 },
    C: { type: Number, default: 2.0 },
    D: { type: Number, default: 1.0 },
    F: { type: Number, default: 0 },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    timezone: { type: String, default: 'Asia/Karachi' },
    gradingScale: { type: gradingScaleSchema, default: () => ({}) },
  },
  { timestamps: true },
);

// Never leak the password hash via JSON — strip it on every serialization.
userSchema.methods.toPublicJSON = function toPublicJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
