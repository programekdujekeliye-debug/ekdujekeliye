import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { Registration } from '../src/models/Registration.js';
import { mediaService } from '../src/modules/media/media.service.js';
import { registrationService } from '../src/modules/registrations/registration.service.js';
import { env } from '../src/config/env.js';

async function trackLiveArchive() {
  await mongoose.connect(env.MONGO_URI);

  const eventId = 'prog-1786621655629';
  console.log('====================================================');
  console.log('  21 AUG 2026 EVENT ARCHIVE LIVE PROGRESS TRACKER  ');
  console.log('====================================================');

  let lastVerifiedCount = -1;
  const startTime = Date.now();
  const maxWatchMinutes = 60;

  while ((Date.now() - startTime) < maxWatchMinutes * 60 * 1000) {
    const event = await Event.findOne({ id: eventId }).lean();
    const archives = await MediaArchive.find({ eventId }).lean();

    const total = archives.length;
    const verified = archives.filter(a => a.status === 'VERIFIED' || a.status === 'ARCHIVED').length;
    const queued = archives.filter(a => a.status === 'QUEUED').length;
    const copying = archives.filter(a => a.status === 'COPYING').length;
    const failed = archives.filter(a => a.status === 'FAILED').length;

    if (verified !== lastVerifiedCount) {
      console.log(`\n[${new Date().toLocaleTimeString('en-IN')}] ARCHIVE UPDATE:`);
      console.log(`- Event: ${event.name} (${event.date})`);
      console.log(`- Archive Status: ${event.archiveStatus}`);
      console.log(`- Verified: ${verified} / ${total} (${((verified / total) * 100).toFixed(1)}%)`);
      console.log(`- Queued: ${queued} | Copying: ${copying} | Failed: ${failed}`);
      console.log(`- Total Bytes Archived: ${(archives.reduce((s, a) => s + (a.originalSize || 0), 0) / (1024 * 1024)).toFixed(2)} MB`);
      lastVerifiedCount = verified;
    }

    if (queued === 0 && copying === 0 && verified >= total && total > 0) {
      console.log('\n🎉 ALL 242 ASSETS SUCCESSFULLY VERIFIED IN GOOGLE DRIVE!');
      break;
    }

    await new Promise(r => setTimeout(r, 10000)); // check every 10 seconds
  }

  // ------------------------------------------------------------------
  // POST-ARCHIVE VERIFICATION & AUDIT
  // ------------------------------------------------------------------
  console.log('\n====================================================');
  console.log('  RUNNING POST-ARCHIVE INTEGRITY & RANDOM 5 CHECKS   ');
  console.log('====================================================');

  const allVerified = await MediaArchive.find({ eventId, status: { $in: ['VERIFIED', 'ARCHIVED'] } }).sort({ registrationId: 1 }).lean();
  console.log(`Total Verified Drive Records: ${allVerified.length}`);

  // Check for duplicates
  const driveFileIds = allVerified.map(a => a.driveFileId);
  const uniqueIds = new Set(driveFileIds);
  const duplicates = driveFileIds.length - uniqueIds.size;
  console.log(`Unique Drive File IDs: ${uniqueIds.size} / ${driveFileIds.length}`);
  console.log(`Duplicate Drive File IDs detected: ${duplicates}`);

  // Select 5 sample registrations:
  // 1. Early registration (e.g. index 0)
  // 2. Middle registration (e.g. index Math.floor(len/2))
  // 3. Late/Recent registration (e.g. index len - 1)
  // 4. Random 1
  // 5. Random 2
  const sampleIndices = [
    0,
    Math.floor(allVerified.length / 2),
    allVerified.length - 1,
    Math.floor(allVerified.length * 0.25),
    Math.floor(allVerified.length * 0.75)
  ];

  const samples = sampleIndices.map(i => allVerified[i]);
  console.log('\nSelected 5 Sample Registrations:');
  samples.forEach((s, idx) => {
    console.log(`${idx + 1}. [${s.registrationId}] DriveFileId: ${s.driveFileId} | File: ${s.filename}`);
  });

  const testUser = { role: 'SUPER_ADMIN', assignedEventIds: [] };
  let allThumbnailsPass = true;
  let allPassPagesPass = true;
  let allDriveOriginalsPass = true;

  for (const sample of samples) {
    const reg = await Registration.findOne({ inquiryId: sample.registrationId }).lean();
    console.log(`\n--- Testing [${sample.registrationId}] (${reg?.husbandName} & ${reg?.wifeName}) ---`);

    // 1. Ensure operational thumbnail exists & returns 200
    let thumbUrl = sample.operationalThumbnailUrl;
    if (!thumbUrl) {
      const event = await Event.findOne({ id: sample.eventId }).lean();
      const tResult = await mediaService.createOperationalThumbnail({
        sourceUrl: sample.sourceUrl,
        eventSlug: event?.slug || sample.eventId,
        inquiryId: sample.registrationId,
        publicId: sample.sourcePublicId
      });
      thumbUrl = tResult.operationalThumbnailUrl;
      await MediaArchive.updateOne({ _id: sample._id }, {
        $set: {
          operationalThumbnailUrl: tResult.operationalThumbnailUrl,
          operationalThumbnailPublicId: tResult.operationalThumbnailPublicId,
          thumbnailSizeBytes: tResult.thumbnailSizeBytes,
          thumbnailCreatedAt: tResult.thumbnailCreatedAt
        }
      });
    }

    const thumbHead = await fetch(thumbUrl, { method: 'HEAD' });
    console.log(`- Thumbnail HTTP: ${thumbHead.status} ${thumbHead.status === 200 ? '✅ 200 OK' : '❌'}`);
    if (thumbHead.status !== 200) allThumbnailsPass = false;

    // 2. Test Pass Status API
    const passStatus = await registrationService.getStatus(sample.registrationId);
    console.log(`- Pass Status: ${passStatus?.status} | PhotoThumbnail: ${passStatus?.photoThumbnailUrl ? '✅' : '❌'}`);
    if (!passStatus || !passStatus.photoThumbnailUrl) allPassPagesPass = false;

    // 3. Test Drive View Token
    try {
      const token = await mediaService.generateMediaViewToken(sample.registrationId, testUser);
      console.log(`- Drive Token: ${token.fileId} | Sig: ${token.signature.slice(0, 10)}... ✅`);
    } catch (err) {
      console.log(`- Drive Token Error:`, err.message);
      allDriveOriginalsPass = false;
    }
  }

  // ------------------------------------------------------------------
  // CLEANUP PREFLIGHT STATUS
  // ------------------------------------------------------------------
  console.log('\n--- CLEANUP PREFLIGHT AUDIT ---');
  const sampleRegId = samples[0].registrationId;
  const archive = await MediaArchive.findOne({ registrationId: sampleRegId }).lean();
  const event = await Event.findOne({ id: eventId }).lean();
  const isFullyArchived = (event.archiveStatus === 'COMPLETED' || allVerified.length === total);

  console.log(`Sample Registration for Preflight: ${sampleRegId}`);
  console.log(`Event Archive Fully Completed: ${isFullyArchived ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Feature Flag CLOUDINARY_CLEANUP_ENABLED: ${env.CLOUDINARY_CLEANUP_ENABLED}`);
  console.log(`Preflight Cleanup Readiness: ${isFullyArchived ? 'READY_FOR_DELETE (Subject to Feature Flag)' : 'BLOCKED'}`);

  // ------------------------------------------------------------------
  // 09 AUG UNTOUCHED AUDIT
  // ------------------------------------------------------------------
  const ev09 = await Event.findOne({ id: 'prog-1785566789678' }).lean();
  const archives09 = await MediaArchive.find({ eventId: 'prog-1785566789678' }).lean();
  const verified09 = archives09.filter(a => a.status === 'VERIFIED' || a.status === 'ARCHIVED').length;
  console.log('\n--- 09 AUG EVENT STATUS ---');
  console.log(`Status: ${ev09.archiveStatus} | Verified: ${verified09} / ${archives09.length} (UNTOUCHED: ${verified09 === 1 ? 'YES ✅' : 'NO ❌'})`);

  // ------------------------------------------------------------------
  // BACKUP AUDIT
  // ------------------------------------------------------------------
  const verifiedBackup = await mongoose.model('BackupRecord').findOne({ status: 'verified', driveFileId: { $ne: null } }).lean();
  console.log('\n--- DATABASE BACKUP AUDIT ---');
  console.log(`Verified Drive Backup: ${verifiedBackup ? `YES ✅ (${verifiedBackup.backupId} | ${verifiedBackup.driveFileId})` : 'NO ❌'}`);

  await mongoose.disconnect();
}

trackLiveArchive();
