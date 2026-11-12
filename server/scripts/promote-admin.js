// Promote an existing user to admin. There is NO open admin self-registration:
// the only way to become an admin is to run this script (or be given the role
// by someone with database access).
//
// Usage:
//   MONGODB_URI="mongodb+srv://..." node scripts/promote-admin.js user@example.com
//   # or with server/.env present (dotenv loads it):
//   node scripts/promote-admin.js user@example.com
//
// Exit 0 on success, 1 on any error (missing email, no MONGODB_URI, unknown user).
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error('Usage: node scripts/promote-admin.js <email>');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set. Put it in server/.env or pass it in the environment.');
  process.exit(1);
}

try {
  await mongoose.connect(uri);
  const user = await User.findOne({ email });
  if (!user) {
    console.error(`No user found with email ${email}. They must register first.`);
    process.exit(1);
  }
  if (user.role === 'admin') {
    console.log(`${email} is already an admin.`);
  } else {
    user.role = 'admin';
    await user.save();
    console.log(`Promoted ${email} to admin.`);
  }
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error('Failed to promote user:', err.message);
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors on the failure path.
  }
  process.exit(1);
}
