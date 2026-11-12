// Seed the platform sample content: a small set of curated CS subjects and
// two sample quiz banks, owned by an existing admin user. Safe to run more
// than once — subjects are upserted by title and sample quizzes are only
// created when no sample with the same title exists yet.
//
// Usage:
//   node scripts/seed-samples.js admin@example.com
// (MONGODB_URI from server/.env or the environment; the user must already
// be an admin — see scripts/promote-admin.js.)
import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { CuratedSubject } from '../src/models/CuratedSubject.js';
import { Quiz } from '../src/models/Quiz.js';

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error('Usage: node scripts/seed-samples.js <admin-email>');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set. Put it in server/.env or pass it in the environment.');
  process.exit(1);
}

const SUBJECTS = [
  { title: 'Data Structures', code: 'CS-201', category: 'Computer Science', description: 'Arrays, linked lists, stacks, queues, trees and graphs.' },
  { title: 'Operating Systems', code: 'CS-301', category: 'Computer Science', description: 'Processes, scheduling, memory management and file systems.' },
  { title: 'Databases', code: 'CS-302', category: 'Computer Science', description: 'Relational design, SQL, indexing and transactions.' },
  { title: 'Computer Networks', code: 'CS-303', category: 'Computer Science', description: 'OSI model, TCP/IP, routing and application protocols.' },
  { title: 'Web Development', code: 'CS-304', category: 'Computer Science', description: 'HTML, CSS, JavaScript and modern web frameworks.' },
];

const SAMPLE_QUIZZES = [
  {
    title: 'Sample: CS Basics',
    description: 'A short sample quiz to try the quiz engine. Copy it to your own quizzes to take it.',
    questions: [
      {
        question: 'What does CPU stand for?',
        options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility'],
        correctIndex: 0,
        explanation: 'CPU = Central Processing Unit.',
      },
      {
        question: 'Which data structure is FIFO?',
        options: ['Stack', 'Queue', 'Tree'],
        correctIndex: 1,
        explanation: 'A queue is first-in, first-out.',
      },
      {
        question: 'How many bits are in a byte?',
        options: ['4', '8', '16'],
        correctIndex: 1,
        explanation: 'One byte is 8 bits.',
      },
    ],
  },
  {
    title: 'Sample: Databases Basics',
    description: 'A short sample quiz on relational databases.',
    questions: [
      {
        question: 'Which language is used to query a relational database?',
        options: ['HTML', 'SQL', 'CSS'],
        correctIndex: 1,
        explanation: 'SQL (Structured Query Language) queries relational databases.',
      },
      {
        question: 'What does a primary key do?',
        options: [
          'It encrypts the table',
          'It uniquely identifies each row',
          'It speeds up the network',
        ],
        correctIndex: 1,
        explanation: 'A primary key uniquely identifies each row in a table.',
      },
    ],
  },
];

try {
  await mongoose.connect(uri);
  const admin = await User.findOne({ email });
  if (!admin) {
    console.error(`No user found with email ${email}. They must register first.`);
    process.exit(1);
  }
  if (admin.role !== 'admin') {
    console.error(`${email} is not an admin yet. Run: node scripts/promote-admin.js ${email}`);
    process.exit(1);
  }

  let subjectsCreated = 0;
  for (const subject of SUBJECTS) {
    const existing = await CuratedSubject.findOne({ title: subject.title });
    if (existing) continue;
    await CuratedSubject.create({ ...subject, createdBy: admin._id });
    subjectsCreated += 1;
  }

  let quizzesCreated = 0;
  for (const quiz of SAMPLE_QUIZZES) {
    const existing = await Quiz.findOne({ title: quiz.title, isSample: true });
    if (existing) continue;
    await Quiz.create({ ...quiz, userId: admin._id, isSample: true });
    quizzesCreated += 1;
  }

  console.log(`Seeded ${subjectsCreated} new curated subjects and ${quizzesCreated} new sample quizzes.`);
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error('Failed to seed samples:', err.message);
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors on the failure path.
  }
  process.exit(1);
}
