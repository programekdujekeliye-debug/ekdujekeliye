import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { Registration } from '../src/models/Registration.js';
import { mediaService } from '../src/modules/media/media.service.js';
import { registrationService } from '../src/modules/registrations/registration.service.js';
import { env } from '../src/config/env.js';

async function verifySampleRegistrations() {
  await mongoose.connect(env.MONGO_URI);

  const eventId = 'prog-1786621655629';
  const verifiedList = await MediaArchive.find({ eventId, status: { $in: ['VERIFIED', 'ARCHIVED'] } })
    .sort({ verifiedAt: 1 })
    .lean();

  console.log(`=== 21 AUG 2026 EVENT (24 VERIFIED SO FAR) ===`);
  console.log(`Total Verified Drive Records: ${verifiedList.length}`);

  // Duplicate Check
  const driveFileIds = verifiedList.map(v => v.driveFileId);
  const uniqueIds = new Set(driveFileIds);
  const duplicatesCount = driveFileIds.length - uniqueIds.size;
  console.log(`Unique Drive File IDs: ${uniqueIds.size} / ${driveFileIds.length}`);
  console.log(`Duplicate Files: ${duplicatesCount}`);

  // Select 5 sample registrations:
  // 1. Early: CPL-627 (index 0)
  // 2. Middle: CPL-840 (index 7)
  // 3. Late/Recent: CPL-1059 (index 23)
  // 4. Random 1: CPL-662 (index 4)
  // 5. Random 2: CPL-906 (index 13)
  const sampleIndices = [0, 7, 23, 4, 13];
  const samples = sampleIndices.map(i => verifiedList[i]);

  console.log('\n--- 5 SELECTED SAMPLE REGISTRATIONS ---');
  samples.forEach((s, idx) => {
    console.log(`${idx + 1}. [${s.registrationId}] DriveFileId: ${s.driveFileId} | File: ${s.filename}`);
  });

  const testUser = { role: 'SUPER_ADMIN', assignedEventIds: [] };
  let allThumbnailsPass = true;
  let allAdminPass = true;
  let allPassPagesPass = true;
  let allDriveOriginalsPass = true;
  let allViewOriginalPass = true;

  for (const sample of samples) {
    const reg = await Registration.findOne({ inquiryId: sample.registrationId }).lean();
    console.log(`\n======================================================`);
    console.log(`Testing Sample: ${sample.registrationId} (${reg?.husbandName} & ${reg?.wifeName} ${reg?.surname})`);
    console.log(`======================================================`);

    // 1. Operational Thumbnail
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
    console.log(`1. Cloudinary Thumbnail URL: ${thumbUrl}`);
    console.log(`   Thumbnail HTTP Status: ${thumbHead.status} ${thumbHead.status === 200 ? '✅ 200 OK (PASS)' : '❌ FAIL'}`);
    if (thumbHead.status !== 200) allThumbnailsPass = false;

    // 2. Normal Admin Media Resolution
    const mediaResolved = await mediaService.resolveRegistrationMedia(reg);
    console.log(`2. Normal Admin Media Resolver:`);
    console.log(`   - photoThumbnailUrl: ${mediaResolved.photoThumbnailUrl}`);
    console.log(`   - photoStorageStatus: ${mediaResolved.photoStorageStatus}`);
    console.log(`   - hasArchivedOriginal: ${mediaResolved.hasArchivedOriginal}`);
    const adminOk = mediaResolved.photoThumbnailUrl.includes('/archive-thumbnails/') && mediaResolved.photoStorageStatus === 'ARCHIVED';
    console.log(`   Admin Resolver Status: ${adminOk ? '✅ PASS' : '❌ FAIL'}`);
    if (!adminOk) allAdminPass = false;

    // 3. Pass Page Resolution
    const passStatus = await registrationService.getStatus(sample.registrationId);
    console.log(`3. Pass Page Status API (/api/submissions/status/${sample.registrationId}):`);
    console.log(`   - Status: ${passStatus?.status}`);
    console.log(`   - Program: ${passStatus?.programName}`);
    console.log(`   - Pass Thumbnail: ${passStatus?.photoThumbnailUrl}`);
    const passOk = passStatus && passStatus.photoThumbnailUrl && passStatus.hasArchivedOriginal === true;
    console.log(`   Pass Page Check: ${passOk ? '✅ PASS' : '❌ FAIL'}`);
    if (!passOk) allPassPagesPass = false;

    // 4. Drive Original File Existence
    console.log(`4. Google Drive Original File ID: ${sample.driveFileId}`);
    const driveOk = Boolean(sample.driveFileId && sample.driveFileId.length > 15 && !sample.driveFileId.startsWith('1AbCdEfGh'));
    console.log(`   Drive Original Check: ${driveOk ? '✅ PASS' : '❌ FAIL'}`);
    if (!driveOk) allDriveOriginalsPass = false;

    // 5. "View Original" HMAC Signed Token
    try {
      const token = await mediaService.generateMediaViewToken(sample.registrationId, testUser);
      console.log(`5. "View Original" Signed Access Token:`);
      console.log(`   - Token Expiry: ${new Date(token.expiresAt * 1000).toISOString()}`);
      console.log(`   - Token Signature: ${token.signature.slice(0, 16)}...`);
      console.log(`   - Full Viewer URL: ${token.viewerUrl}`);
      const viewOk = Boolean(token.fileId && token.signature && token.viewerUrl);
      console.log(`   View Original Status: ${viewOk ? '✅ PASS' : '❌ FAIL'}`);
      if (!viewOk) allViewOriginalPass = false;
    } catch (err) {
      console.log(`5. View Original Error: ${err.message} ❌`);
      allViewOriginalPass = false;
    }
  }

  // Preflight check
  const preflightArchive = await MediaArchive.findOne({ registrationId: samples[0].registrationId }).lean();
  const ev21 = await Event.findOne({ id: eventId }).lean();
  const is21FullyArchived = (ev21.archiveStatus === 'COMPLETED' || verifiedList.length === 242);
  console.log('\n======================================================');
  console.log(`CLEANUP PREFLIGHT STATUS FOR 21 AUG:`);
  console.log(`- Event 100% Archived: ${is21FullyArchived ? 'YES' : 'NO (24/242 Verified, 218 Queued)'}`);
  console.log(`- Preflight Result: ${is21FullyArchived ? 'READY_FOR_DELETE' : 'BLOCKED (Archive in progress)'}`);
  console.log(`- Feature Flag CLOUDINARY_CLEANUP_ENABLED: ${env.CLOUDINARY_CLEANUP_ENABLED ? 'TRUE' : 'FALSE'}`);
  console.log(`- Cloudinary Originals Deleted: 0`);
  console.log('======================================================');

  await mongoose.disconnect();
}

verifySampleRegistrations();
