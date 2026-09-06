import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { Event } from '../src/models/Event.js';

async function run() {
  await mongoose.connect(env.PROD_MONGO_URI);
  const now = new Date();

  async function getDueCount(eventId) {
    const candidateQuery = {
      status: 'QUEUED',
      scheduledFor: { $lte: now }
    };
    if (eventId && eventId !== 'all') {
      const eventDoc = await Event.findOne({
        $or: [
          { id: eventId },
          { slug: eventId },
          ...(mongoose.isValidObjectId(eventId) ? [{ _id: eventId }] : [])
        ]
      }).lean();
      const eventIds = [eventId, eventDoc?.id, eventDoc?.slug, eventDoc?.date].filter(Boolean);
      candidateQuery.eventId = { $in: eventIds };
    }
    return await WhatsappMessage.countDocuments(candidateQuery);
  }

  const c1 = await getDueCount('prog-2026-09-07');
  const c2 = await getDueCount('6a90570d055ee8341adb46c5');
  const c3 = await getDueCount('surat-7-september-2026');
  const c4 = await getDueCount('all');

  console.log('Count with prog-2026-09-07:', c1);
  console.log('Count with ObjectId:', c2);
  console.log('Count with slug:', c3);
  console.log('Count with ALL:', c4);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
