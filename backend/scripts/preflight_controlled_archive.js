import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { BackupRecord } from '../src/models/BackupRecord.js';
import { env } from '../src/config/env.js';

async function preflightBaseline() {
  await mongoose.connect(env.MONGO_URI);
  console.log('====================================================');
  console.log('       EVENT ARCHIVE PRE-FLIGHT BASELINE AUDIT      ');
  console.log('====================================================');

  // 1. Locate the 2026-08-09 event
  const events = await Event.find({ date: '2026-08-09' }).lean();
  console.log(`Target Events for 2026-08-09: ${events.length}`);
  for (const e of events) {
    console.log(`- Event ID: ${e.id} | Name: ${e.name} | Slug: ${e.slug || e.id} | City: ${e.city} | Status: ${e.status}`);
  }

  const targetEventId = events[0]?.id;

  // 2. Count Registrations for this event
  const regs = await Registration.find({ programId: targetEventId, isDeleted: { $ne: true } }).lean();
  const eligiblePhotos = regs.filter(r => r.couplePhoto && (r.couplePhoto.startsWith('http') || r.couplePhoto.startsWith('/uploads')));
  console.log(`\nTarget Event Registrations: ${regs.length}`);
  console.log(`Eligible Couple Photos: ${eligiblePhotos.length}`);

  // 3. Current MediaArchive records for target event
  const existingArchives = await MediaArchive.find({ eventId: targetEventId }).lean();
  const verifiedCount = existingArchives.filter(a => a.status === 'VERIFIED').length;
  const queuedCount = existingArchives.filter(a => a.status === 'QUEUED').length;
  const copyingCount = existingArchives.filter(a => a.status === 'COPYING').length;
  const failedCount = existingArchives.filter(a => a.status === 'FAILED').length;

  console.log(`\nExisting MediaArchive Records for ${targetEventId}:`);
  console.log(`- Total Records: ${existingArchives.length}`);
  console.log(`- VERIFIED: ${verifiedCount}`);
  console.log(`- QUEUED: ${queuedCount}`);
  console.log(`- COPYING: ${copyingCount}`);
  console.log(`- FAILED: ${failedCount}`);

  // Check CPL-559
  const cpl559Archive = existingArchives.find(a => a.registrationId === 'CPL-559');
  console.log(`- CPL-559 Status: ${cpl559Archive?.status} | DriveFileId: ${cpl559Archive?.driveFileId}`);

  // 4. Baseline for unrelated TBD event
  const tbdArchives = await MediaArchive.find({ eventId: 'prog-1785924307713' }).lean();
  const tbdQueued = tbdArchives.filter(a => a.status === 'QUEUED').length;
  const tbdVerified = tbdArchives.filter(a => a.status === 'VERIFIED').length;
  console.log(`\nUnrelated TBD Event (prog-1785924307713) Baseline:`);
  console.log(`- QUEUED: ${tbdQueued} (Must remain UNTOUCHED)`);
  console.log(`- VERIFIED: ${tbdVerified}`);

  // 5. Verified Database Backups check
  const backups = await BackupRecord.find({ status: 'verified' }).lean();
  console.log(`\nVerified Database Backups in Ledger: ${backups.length}`);

  await mongoose.disconnect();
}

preflightBaseline();
