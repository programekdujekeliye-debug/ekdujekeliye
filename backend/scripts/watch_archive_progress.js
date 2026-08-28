import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

async function watchProgress() {
  await mongoose.connect(env.MONGO_URI);
  const eventId = 'prog-1786621655629';

  for (let i = 0; i < 6; i++) {
    const event = await Event.findOne({ id: eventId }).lean();
    const archives = await MediaArchive.find({ eventId }).lean();

    const total = archives.length;
    const verified = archives.filter(a => a.status === 'VERIFIED' || a.status === 'ARCHIVED').length;
    const queued = archives.filter(a => a.status === 'QUEUED').length;
    const copying = archives.filter(a => a.status === 'COPYING').length;
    const failed = archives.filter(a => a.status === 'FAILED').length;

    console.log(`[Check ${i + 1}/6] Event: ${event.name} | Verified: ${verified}/${total} (${((verified/total)*100).toFixed(1)}%) | Queued: ${queued} | Copying: ${copying} | Failed: ${failed} | LastWorker: ${event.archiveStats?.lastWorkerAt || 'N/A'}`);
    
    if (i < 5) await new Promise(r => setTimeout(r, 5000));
  }

  await mongoose.disconnect();
}

watchProgress();
