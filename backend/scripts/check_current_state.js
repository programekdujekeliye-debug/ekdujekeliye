import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { BackupRecord } from '../src/models/BackupRecord.js';
import { env } from '../src/config/env.js';

async function checkCurrentState() {
  await mongoose.connect(env.MONGO_URI);

  console.log('=== CHECKING CURRENT ACTIVE EVENT & ARCHIVE STATUS ===');
  const activeEvents = await Event.find({ archiveStatus: 'ARCHIVING' }).lean();
  console.log(`Active Events in ARCHIVING state: ${activeEvents.length}`);
  activeEvents.forEach(e => {
    console.log(`- Active: "${e.name}" | ID: ${e.id} | Date: ${e.date}`);
  });

  const ev21 = await Event.findOne({ id: 'prog-1786621655629' }).lean();
  console.log('\n--- 21 AUG 2026 EVENT ---');
  console.log('Name:', ev21?.name, '| ID:', ev21?.id, '| Date:', ev21?.date);
  console.log('Event Status:', ev21?.status, '| Archive Status:', ev21?.archiveStatus);
  console.log('Archive Stats on Event:', ev21?.archiveStats);

  const eligible21 = await Registration.countDocuments({
    programId: 'prog-1786621655629',
    isDeleted: { $ne: true },
    couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
  });
  const archives21 = await MediaArchive.find({ eventId: 'prog-1786621655629' }).lean();
  const queued21 = archives21.filter(a => a.status === 'QUEUED').length;
  const copying21 = archives21.filter(a => a.status === 'COPYING').length;
  const verified21 = archives21.filter(a => a.status === 'VERIFIED' || a.status === 'ARCHIVED').length;
  const failed21 = archives21.filter(a => a.status === 'FAILED').length;

  console.log(`Eligible Submissions with Photos: ${eligible21}`);
  console.log(`MediaArchive Total: ${archives21.length}`);
  console.log(`- VERIFIED: ${verified21}`);
  console.log(`- QUEUED: ${queued21}`);
  console.log(`- COPYING: ${copying21}`);
  console.log(`- FAILED: ${failed21}`);

  console.log('\n--- 09 AUG 2026 EVENT (SHOULD BE UNTOUCHED) ---');
  const ev09 = await Event.findOne({ id: 'prog-1785566789678' }).lean();
  const archives09 = await MediaArchive.find({ eventId: 'prog-1785566789678' }).lean();
  console.log('Archive Status:', ev09?.archiveStatus);
  console.log(`- VERIFIED: ${archives09.filter(a => a.status === 'VERIFIED' || a.status === 'ARCHIVED').length}`);
  console.log(`- QUEUED: ${archives09.filter(a => a.status === 'QUEUED').length}`);

  console.log('\n--- DATABASE BACKUP RECORDS ---');
  const backups = await BackupRecord.find().sort({ startedAt: -1 }).lean();
  console.log(`Total Backups: ${backups.length}`);
  backups.forEach((b, i) => {
    console.log(`${i + 1}. ID: ${b.backupId} | Status: ${b.status} | DriveFileId: ${b.driveFileId || 'None'} | Size: ${b.size} bytes`);
  });

  await mongoose.disconnect();
}

checkCurrentState();
