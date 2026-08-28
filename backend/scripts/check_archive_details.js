import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

async function checkDetails() {
  await mongoose.connect(env.MONGO_URI);

  const event1 = await Event.findOne({ id: 'prog-1785566789678' }).lean();
  console.log('Event 1 (2026-08-09):', event1?.name, '| Status:', event1?.status, '| ArchiveStatus:', event1?.archiveStatus, '| Stats:', event1?.archiveStats);
  const archives1 = await MediaArchive.find({ eventId: 'prog-1785566789678' }).lean();
  console.log('Event 1 Archives:', {
    total: archives1.length,
    QUEUED: archives1.filter(a => a.status === 'QUEUED').length,
    COPYING: archives1.filter(a => a.status === 'COPYING').length,
    VERIFIED: archives1.filter(a => a.status === 'VERIFIED').length,
    FAILED: archives1.filter(a => a.status === 'FAILED').length
  });

  const event2 = await Event.findOne({ id: 'prog-1786621655629' }).lean();
  console.log('\nEvent 2 (2026-08-21):', event2?.name, '| Status:', event2?.status, '| ArchiveStatus:', event2?.archiveStatus, '| Stats:', event2?.archiveStats);
  const archives2 = await MediaArchive.find({ eventId: 'prog-1786621655629' }).lean();
  console.log('Event 2 Archives:', {
    total: archives2.length,
    QUEUED: archives2.filter(a => a.status === 'QUEUED').length,
    COPYING: archives2.filter(a => a.status === 'COPYING').length,
    VERIFIED: archives2.filter(a => a.status === 'VERIFIED').length,
    FAILED: archives2.filter(a => a.status === 'FAILED').length
  });

  const allVerified = await MediaArchive.find({ status: 'VERIFIED' }).lean();
  console.log('\nAll Verified MediaArchives:');
  for (const v of allVerified) {
    const reg = await Registration.findOne({ inquiryId: v.registrationId }).lean();
    console.log(`- RegId: ${v.registrationId} | Event: ${v.eventId} | PublicId: ${v.sourcePublicId} | DriveFileId: ${v.driveFileId} | SourceUrl: ${v.sourceUrl} | RegPhoto: ${reg?.couplePhoto}`);
  }

  await mongoose.disconnect();
}

checkDetails();
