import { connectDatabase } from '../src/config/database.js';
import { Event } from '../src/models/Event.js';
import mongoose from 'mongoose';

async function updateCapacity() {
  await connectDatabase();
  const res = await Event.updateMany(
    { $or: [{ date: '2026-09-07' }, { id: 'prog-2026-09-07' }, { date: '2026-09-12' }, { id: 'prog-2026-09-12' }] },
    { $set: { capacity: 1000 } }
  );
  console.log('Updated Event Capacity to 1000:', res);

  await mongoose.disconnect();
  process.exit(0);
}

updateCapacity();
