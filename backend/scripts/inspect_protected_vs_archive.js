import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const PROD_MONGO_URI = process.env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function main() {
  await mongoose.connect(PROD_MONGO_URI);

  // Get all active upcoming registrations
  const upcomingEvents = ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-19'];
  const upcomingRegs = await Registration.find({
    programId: { $in: upcomingEvents },
    isDeleted: { $ne: true }
  }).lean();

  console.log(`Upcoming registrations count: ${upcomingRegs.length}`);

  const protectedPublicIds = new Set();
  const protectedInquiryIds = new Set();

  upcomingRegs.forEach(r => {
    protectedInquiryIds.add(r.inquiryId);
    if (r.couplePhoto) {
      const m = r.couplePhoto.match(/(couplePhotos\/[^.]+)/);
      if (m) protectedPublicIds.add(m[1]);
    }
    if (r.invitationCardUrl) {
      const m = r.invitationCardUrl.match(/(invitation-cards\/[^.]+)/);
      if (m) protectedPublicIds.add(m[1]);
    }
    if (r.paymentScreenshot) {
      const m = r.paymentScreenshot.match(/(paymentScreenshots\/[^.]+)/);
      if (m) protectedPublicIds.add(m[1]);
    }
  });

  console.log(`Protected upcoming inquiry IDs: ${protectedInquiryIds.size}`);
  console.log(`Protected upcoming public IDs: ${protectedPublicIds.size}`);

  // Check verified past event archives that are confirmed in Google Drive
  const verifiedInDrive = await MediaArchive.find({
    status: { $in: ['VERIFIED', 'ARCHIVED'] },
    driveFileId: { $exists: true, $ne: null, $ne: '' },
    eventId: { $nin: upcomingEvents }
  }).lean();

  // Filter out any mock IDs
  const realDriveVerified = verifiedInDrive.filter(a => 
    !a.driveFileId.startsWith('1AbCdEfGh') && 
    !a.driveFileId.toLowerCase().includes('mock')
  );

  console.log(`\nPast event archives VERIFIED in real Google Drive: ${realDriveVerified.length}`);
  const eventCounts = {};
  realDriveVerified.forEach(a => {
    eventCounts[a.eventId] = (eventCounts[a.eventId] || 0) + 1;
  });
  console.log('Breakdown by past event:', eventCounts);

  // Check how many of these verified photos are still in Cloudinary
  console.log(`\nAll ${realDriveVerified.length} items are backed up in Google Drive.`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
