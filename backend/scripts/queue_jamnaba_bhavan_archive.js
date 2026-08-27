import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

async function queueJamnabaEvent() {
  await mongoose.connect(env.MONGO_URI);
  console.log('====================================================');
  console.log('  QUEUEING JAMNABA BHAVAN (2026-08-09) FOR ARCHIVE  ');
  console.log('====================================================');

  const eventId = 'prog-1785566789678';
  const event = await Event.findOne({ id: eventId });
  if (!event) {
    console.error('Event not found!');
    await mongoose.disconnect();
    return;
  }

  const submissions = await Registration.find({
    programId: eventId,
    isDeleted: { $ne: true },
    couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
  }).lean();

  console.log(`Total Registrations with Photos for ${eventId}: ${submissions.length}`);

  const eventSlug = event.slug || event.id;
  const itemsToInsert = [];

  const publicIds = submissions.map(sub => {
    const photoUrl = sub.couplePhoto;
    const publicIdMatch = photoUrl.match(/\/([^/]+)\.(jpg|jpeg|png|webp)/i);
    return publicIdMatch ? publicIdMatch[1] : `sub_${sub.inquiryId}_photo`;
  });

  const existingRecords = await MediaArchive.find({ sourcePublicId: { $in: publicIds } }).lean();
  const existingMap = new Map(existingRecords.map(r => [r.sourcePublicId, r]));
  console.log(`Existing MediaArchive records detected: ${existingRecords.length}`);

  for (const sub of submissions) {
    const photoUrl = sub.couplePhoto;
    const publicIdMatch = photoUrl.match(/\/([^/]+)\.(jpg|jpeg|png|webp)/i);
    const publicId = publicIdMatch ? publicIdMatch[1] : `sub_${sub.inquiryId}_photo`;

    if (!existingMap.has(publicId)) {
      const filename = `${sub.inquiryId}_${sub.husbandName}_${sub.wifeName}_${sub.surname}.jpg`.replace(/[^a-zA-Z0-9._-]/g, '_');
      itemsToInsert.push({
        eventId,
        registrationId: sub.inquiryId,
        mediaType: 'couple_photo',
        sourceProvider: photoUrl.includes('cloudinary') ? 'cloudinary' : 'local',
        sourcePublicId: publicId,
        sourceUrl: photoUrl.startsWith('http') ? photoUrl : `https://ekdujekeliye.onrender.com${photoUrl}`,
        destinationProvider: 'google_drive',
        driveFolderPath: `Ek Duje Ke Liye/Events/${eventSlug}/Couple Photos`,
        filename,
        mimeType: 'image/jpeg',
        status: 'QUEUED',
        retainOperationalCopy: true
      });
    } else {
      const rec = existingMap.get(publicId);
      console.log(`- Skipping ${sub.inquiryId} (${publicId}): Already in database with status '${rec.status}'`);
    }
  }

  console.log(`\nNew items to insert as QUEUED: ${itemsToInsert.length}`);

  if (itemsToInsert.length > 0) {
    await MediaArchive.insertMany(itemsToInsert, { ordered: false });
    console.log(`✅ Successfully queued ${itemsToInsert.length} new jobs for ${event.name}!`);
  }

  // Update Event archive status
  const verifiedCount = await MediaArchive.countDocuments({ eventId, status: 'VERIFIED' });
  const queuedCount = await MediaArchive.countDocuments({ eventId, status: 'QUEUED' });
  event.archiveStatus = queuedCount > 0 ? 'QUEUED' : 'ARCHIVED';
  await event.save();

  console.log(`\nEvent ${event.name} state:`);
  console.log(`- Total Eligible: ${submissions.length}`);
  console.log(`- VERIFIED: ${verifiedCount}`);
  console.log(`- QUEUED: ${queuedCount}`);

  // Confirm TBD event was NOT touched
  const tbdQueued = await MediaArchive.countDocuments({ eventId: 'prog-1785924307713', status: 'QUEUED' });
  console.log(`\nUnrelated TBD Event Queued Jobs: ${tbdQueued} (UNTOUCHED)`);

  await mongoose.disconnect();
}

queueJamnabaEvent();
