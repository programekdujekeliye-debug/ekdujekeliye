import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

async function checkArchives() {
  await mongoose.connect(env.MONGO_URI);

  const allVerified = await MediaArchive.find({ status: { $in: ['VERIFIED', 'ARCHIVED'] } }).lean();
  console.log(`Total VERIFIED/ARCHIVED records across all events: ${allVerified.length}`);
  allVerified.forEach((a, i) => {
    console.log(`${i + 1}. Event: ${a.eventId} | RegId: ${a.registrationId} | Status: ${a.status} | DriveFileId: ${a.driveFileId} | Filename: ${a.filename}`);
  });

  const events = await Event.find().lean();
  console.log('\nEvents overview:');
  for (const ev of events) {
    const archives = await MediaArchive.find({ eventId: ev.id }).lean();
    const stats = archives.reduce((acc, cur) => {
      acc[cur.status] = (acc[cur.status] || 0) + 1;
      return acc;
    }, {});
    console.log(`- ${ev.name} (${ev.date}) [${ev.id}]: Total Archives = ${archives.length}, Breakdown =`, stats);
  }

  await mongoose.disconnect();
}

checkArchives();
