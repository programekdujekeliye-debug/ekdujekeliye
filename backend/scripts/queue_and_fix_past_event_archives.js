import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { Registration } from '../src/models/Registration.js';
import { updateEventArchiveProgress } from '../src/modules/archive/archive.controller.js';

const PROD_MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function main() {
  console.log('====================================================');
  console.log('  QUEUE & FIX PAST EVENT ARCHIVES FOR GOOGLE DRIVE  ');
  console.log('====================================================');

  await mongoose.connect(PROD_MONGO_URI);
  console.log('Connected to Production MongoDB.');

  // ---------------------------------------------------------------
  // 1. FIX THE 15 FAILED ITEMS (CONVERT .HEIC TO .JPG & RESET RETRY)
  // ---------------------------------------------------------------
  console.log('\n--- STEP 1: FIXING FAILED ARCHIVE ITEMS ---');
  const failedItems = await MediaArchive.find({ status: 'FAILED' });
  console.log(`Found ${failedItems.length} failed archive records.`);

  let fixedCount = 0;
  for (const item of failedItems) {
    let newSourceUrl = item.sourceUrl;
    if (newSourceUrl && newSourceUrl.includes('.heic')) {
      newSourceUrl = newSourceUrl.replace(/\.heic$/i, '.jpg');
      item.sourceUrl = newSourceUrl;
      item.mimeType = 'image/jpeg';
    }
    item.status = 'QUEUED';
    item.lastError = null;
    item.workerId = null;
    item.claimedAt = null;
    await item.save();
    fixedCount++;
  }
  console.log(`Reset ${fixedCount} failed items back to QUEUED (with sanitized JPEG URLs).`);

  // ---------------------------------------------------------------
  // 2. QUEUE EVENT prog-1784728718428 (7 AUG, 575 PHOTOS)
  // ---------------------------------------------------------------
  console.log('\n--- STEP 2: QUEUE EVENT prog-1784728718428 (7 AUG) ---');
  const event7Aug = await Event.findOne({ id: 'prog-1784728718428' });
  if (event7Aug) {
    const regs7Aug = await Registration.find(
      {
        programId: 'prog-1784728718428',
        isDeleted: { $ne: true },
        couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
      },
      { inquiryId: 1, couplePhoto: 1, husbandName: 1, wifeName: 1, surname: 1 }
    ).lean();

    console.log(`Found ${regs7Aug.length} registrations with couple photos for 7 Aug event.`);

    const existingArchives = await MediaArchive.find({ eventId: 'prog-1784728718428' }).select('sourcePublicId').lean();
    const existingSet = new Set(existingArchives.map(a => a.sourcePublicId));

    const toInsert = [];
    for (const sub of regs7Aug) {
      let photoUrl = sub.couplePhoto;
      if (!photoUrl) continue;

      // Sanitize .heic to .jpg for Google Apps Script compatibility
      if (photoUrl.includes('.heic')) {
        photoUrl = photoUrl.replace(/\.heic$/i, '.jpg');
      }

      const publicIdMatch = photoUrl.match(/\/([^/]+)\.(jpg|jpeg|png|webp)/i);
      const publicId = publicIdMatch ? publicIdMatch[1] : `sub_${sub.inquiryId}_photo`;

      if (!existingSet.has(publicId)) {
        const filename = `${sub.inquiryId || 'reg'}_${sub.husbandName || 'couple'}_${sub.wifeName || ''}_${sub.surname || ''}.jpg`.replace(/[^a-zA-Z0-9._-]/g, '_');
        toInsert.push({
          eventId: 'prog-1784728718428',
          registrationId: sub.inquiryId,
          mediaType: 'couple_photo',
          sourceProvider: 'cloudinary',
          sourcePublicId: publicId,
          sourceUrl: photoUrl.startsWith('http') ? photoUrl : `https://ekdujekeliye.onrender.com${photoUrl}`,
          destinationProvider: 'google_drive',
          driveFolderPath: `Ek Duje Ke Liye/Events/${event7Aug.slug || event7Aug.id}/Couple Photos`,
          filename,
          mimeType: 'image/jpeg',
          status: 'QUEUED',
          retainOperationalCopy: true
        });
      }
    }

    if (toInsert.length > 0) {
      await MediaArchive.collection.insertMany(toInsert, { ordered: false });
      console.log(`Successfully queued ${toInsert.length} couple photos for 7 Aug event.`);
    } else {
      console.log(`All items for 7 Aug already queued (${existingSet.size} existing).`);
    }

    event7Aug.archiveStatus = 'ARCHIVING';
    event7Aug.archiveRequestedAt = new Date();
    await event7Aug.save();
    await updateEventArchiveProgress('prog-1784728718428');
  }

  // ---------------------------------------------------------------
  // 3. SANITIZE ANY .HEIC IN prog-1785566789678 (9 AUG)
  // ---------------------------------------------------------------
  console.log('\n--- STEP 3: SANITIZE 9 AUG QUEUED ITEMS ---');
  const queued9Aug = await MediaArchive.find({ eventId: 'prog-1785566789678', status: 'QUEUED' });
  let sanitized9Aug = 0;
  for (const item of queued9Aug) {
    if (item.sourceUrl && item.sourceUrl.includes('.heic')) {
      item.sourceUrl = item.sourceUrl.replace(/\.heic$/i, '.jpg');
      item.mimeType = 'image/jpeg';
      await item.save();
      sanitized9Aug++;
    }
  }
  console.log(`Sanitized ${sanitized9Aug} .heic URLs in 9 Aug event queue.`);

  console.log('\n--- ALL PAST EVENT ARCHIVES READY FOR GOOGLE DRIVE SYNC ---');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error in queue/fix script:', err);
  process.exit(1);
});
