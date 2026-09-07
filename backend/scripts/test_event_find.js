import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  
  const programs = await Event.find({}).lean();
  console.log('Programs count in program collection:', programs.length);
  for (const p of programs) {
    console.log(`- _id: ${p._id}, id: ${p.id}, slug: ${p.slug}, date: ${p.date}`);
  }

  const prog07 = await Event.findOne({
    $or: [
      { id: 'prog-2026-09-07' },
      { slug: 'surat-7-september-2026' },
      { _id: new mongoose.Types.ObjectId('6a90570d055ee8341adb46c5') }
    ]
  }).lean();
  console.log('prog07 event found:', prog07 ? { _id: prog07._id, id: prog07.id, slug: prog07.slug, status: prog07.status } : 'NOT FOUND');

  for (const testInput of ['prog-2026-09-07', '6a90570d055ee8341adb46c5', 'surat-7-september-2026', undefined]) {
    const candidateQuery = {
      status: 'QUEUED',
      scheduledFor: { $lte: new Date() }
    };
    if (testInput && testInput !== 'all') {
      const eventDoc = await Event.findOne({
        $or: [
          { id: testInput },
          { slug: testInput },
          ...(mongoose.isValidObjectId(testInput) ? [{ _id: testInput }] : [])
        ]
      }).lean();
      const eventIds = [testInput, eventDoc?.id, eventDoc?.slug, eventDoc?.date].filter(Boolean);
      candidateQuery.eventId = { $in: eventIds };
    }
    const count = await WhatsappMessage.countDocuments(candidateQuery);
    console.log(`Input: ${testInput} -> count: ${count}`);
  }

  process.exit(0);
}

main().catch(console.error);
