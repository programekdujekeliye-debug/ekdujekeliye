import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

async function listAllEvents() {
  await mongoose.connect(env.MONGO_URI);
  const events = await Event.find().sort({ date: 1 }).lean();
  console.log('--- ALL EVENTS & ELIGIBLE PHOTO COUNTS ---');
  for (const ev of events) {
    const totalRegs = await Registration.countDocuments({ programId: ev.id, isDeleted: { $ne: true } });
    const photoCount = await Registration.countDocuments({
      programId: ev.id,
      isDeleted: { $ne: true },
      couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
    });
    const queuedCount = await MediaArchive.countDocuments({ eventId: ev.id, status: 'QUEUED' });
    const verifiedCount = await MediaArchive.countDocuments({ eventId: ev.id, status: 'VERIFIED' });

    console.log(
      `ID: ${ev.id.padEnd(24)} | Date: ${(ev.date || '').padEnd(10)} | Status: ${(ev.status || '').padEnd(10)} | Regs: ${String(totalRegs).padEnd(4)} | Photos: ${String(photoCount).padEnd(4)} | Queued: ${queuedCount} | Verified: ${verifiedCount}`
    );
  }
  await mongoose.disconnect();
}

listAllEvents();
