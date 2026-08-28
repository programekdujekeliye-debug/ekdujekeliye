import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { Registration } from '../src/models/Registration.js';
import { env } from '../src/config/env.js';

async function monitorProgress() {
  await mongoose.connect(env.MONGO_URI);

  const eventId = 'prog-1786621655629';
  const event = await Event.findOne({ id: eventId }).lean();
  const archives = await MediaArchive.find({ eventId }).lean();

  const total = archives.length;
  const verified = archives.filter(a => a.status === 'VERIFIED' || a.status === 'ARCHIVED').length;
  const queued = archives.filter(a => a.status === 'QUEUED').length;
  const copying = archives.filter(a => a.status === 'COPYING').length;
  const failed = archives.filter(a => a.status === 'FAILED').length;

  console.log(`[21 AUG ARCHIVE MONITOR]`);
  console.log(`Event Archive Status: ${event.archiveStatus}`);
  console.log(`Verified: ${verified} / ${total} (${((verified / total) * 100).toFixed(1)}%)`);
  console.log(`Queued: ${queued} | Copying: ${copying} | Failed: ${failed}`);
  console.log(`Last Worker Heartbeat: ${event.archiveStats?.lastWorkerAt || 'N/A'}`);

  await mongoose.disconnect();
}

monitorProgress();
