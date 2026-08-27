import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

async function resetArchiveStates() {
  await mongoose.connect(env.MONGO_URI);
  console.log('====================================================');
  console.log('       RESETTING EVENT ARCHIVE BASELINE STATES      ');
  console.log('====================================================');

  // 1. Reset all events archiveStatus to NOT_REQUIRED or QUEUED
  await Event.updateMany({}, { $set: { archiveStatus: 'NOT_REQUIRED' } });
  await Event.updateOne({ id: 'prog-1785566789678' }, { $set: { archiveStatus: 'QUEUED' } });

  // 2. Reset TBD jobs back to QUEUED (and preserve 1 verified)
  await MediaArchive.updateMany({ eventId: 'prog-1785924307713' }, { $set: { status: 'QUEUED', workerId: null, claimedAt: null } });
  await MediaArchive.updateOne({ eventId: 'prog-1785924307713', driveFileId: { $ne: null } }, { $set: { status: 'VERIFIED' } });

  // 3. Reset Jamnaba Bhavan jobs (preserve CPL-559 as verified, rest as queued)
  await MediaArchive.updateMany(
    { eventId: 'prog-1785566789678', registrationId: { $ne: 'CPL-559' } },
    { $set: { status: 'QUEUED', workerId: null, claimedAt: null } }
  );
  await MediaArchive.updateOne(
    { eventId: 'prog-1785566789678', registrationId: 'CPL-559' },
    { $set: { status: 'VERIFIED' } }
  );

  console.log('\n--- ALL EVENTS & ARCHIVE STATUSES ---');
  const events = await Event.find({}).lean();
  for (const e of events) {
    console.log(`- ID: ${e.id} | Name: ${e.name} | Date: ${e.date} | Status: ${e.status} | ArchiveStatus: ${e.archiveStatus}`);
  }

  const tbdQueued = await MediaArchive.countDocuments({ eventId: 'prog-1785924307713', status: 'QUEUED' });
  const jamnabaQueued = await MediaArchive.countDocuments({ eventId: 'prog-1785566789678', status: 'QUEUED' });
  const jamnabaVerified = await MediaArchive.countDocuments({ eventId: 'prog-1785566789678', status: 'VERIFIED' });

  console.log(`\nTBD Event (prog-1785924307713) Queued: ${tbdQueued}`);
  console.log(`Jamnaba Bhavan (prog-1785566789678) Queued: ${jamnabaQueued} | Verified: ${jamnabaVerified}`);

  await mongoose.disconnect();
}

resetArchiveStates();
