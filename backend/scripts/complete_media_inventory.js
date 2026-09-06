/**
 * EDKL COMPLETE MEDIA INVENTORY & EVENT CLASSIFICATION SCRIPT
 * 
 * Safe, read-only audit of all Cloudinary assets and Event classifications.
 * 
 * Guarantees:
 * - Read-only: ZERO deletes, zero updates.
 * - Secure: No hardcoded credentials, reads PROD_MONGO_URI / MONGO_URI.
 * - Checks dbName === 'ekdujekeliye' in --prod mode.
 * - No PII output.
 */

import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { Pass } from '../src/models/Pass.js';
import { Feedback } from '../src/models/Feedback.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Helper: check if string is Cloudinary URL
function isCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('res.cloudinary.com') || url.includes('cloudinary.com');
}

// Helper: extract public ID from Cloudinary URL
function extractPublicId(url) {
  if (!isCloudinaryUrl(url)) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    let pathPart = parts[1];
    // Remove transformation segments e.g. v1234/ or w_240/
    const subParts = pathPart.split('/');
    // Check if first subparts are transformations or version
    let startIndex = 0;
    while (startIndex < subParts.length && (subParts[startIndex].match(/^[a-z]_[a-z0-9_,]+$/i) || subParts[startIndex].match(/^v\d+$/))) {
      startIndex++;
    }
    const cleanPath = subParts.slice(startIndex).join('/');
    // Remove file extension
    const dotIdx = cleanPath.lastIndexOf('.');
    return dotIdx !== -1 ? cleanPath.substring(0, dotIdx) : cleanPath;
  } catch (e) {
    return null;
  }
}

async function runInventory() {
  const args = process.argv.slice(2);
  const isProd = args.includes('--prod');

  const targetUri = isProd
    ? (process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || process.env.MONGO_URI)
    : (process.env.MONGO_URI || env.MONGO_URI);

  if (!targetUri) {
    console.error('[SECURITY ERROR] MongoDB URI environment variable is required.');
    process.exit(1);
  }

  await mongoose.connect(targetUri);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`\n>>> Connected to MongoDB: ${dbName} (Target: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'})`);

  if (isProd && dbName !== 'ekdujekeliye') {
    console.error(`[SAFETY BLOCK] --prod requires databaseName=ekdujekeliye, but connected to '${dbName}'. ABORTING.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // 1. Fetch Cloudinary Usage API
  console.log('\n====================================================');
  console.log('  1. CLOUDINARY LIVE ACCOUNT USAGE                  ');
  console.log('====================================================');
  let cldUsage = null;
  try {
    cldUsage = await cloudinary.api.usage();
    const bwGb = (cldUsage.bandwidth?.usage || 0) / (1024 * 1024 * 1024);
    const storageGb = (cldUsage.storage?.usage || 0) / (1024 * 1024 * 1024);
    const transK = (cldUsage.transformations?.usage || 0) / 1000;
    const creditsUsed = cldUsage.credits?.usage || (bwGb + storageGb + transK);
    const creditsLimit = cldUsage.credits?.limit || 25;

    console.log(`Plan:            ${cldUsage.plan || 'Free'}`);
    console.log(`Bandwidth:       ${bwGb.toFixed(2)} GB (${bwGb.toFixed(2)} credits)`);
    console.log(`Transformations: ${transK.toFixed(2)}K (${transK.toFixed(2)} credits)`);
    console.log(`Managed Storage: ${storageGb.toFixed(3)} GB (${storageGb.toFixed(3)} credits) [Target: <= 0.40-0.50 GB]`);
    console.log(`Total Credits:   ${creditsUsed.toFixed(2)} / ${creditsLimit} credits (${(creditsUsed / creditsLimit * 100).toFixed(1)}%)`);
    console.log(`Total Resources: ${cldUsage.resources || 'N/A'}`);
  } catch (err) {
    console.warn('[Cloudinary Usage API Warning]:', err.message);
  }

  // 2. Fetch and classify all Events
  console.log('\n====================================================');
  console.log('  2. EVENT INVENTORY & CLASSIFICATION               ');
  console.log('====================================================');
  const allEvents = await Event.find({}).sort({ sequenceNumber: 1, createdAt: 1 }).lean();
  console.log(`Total Events found in DB: ${allEvents.length}`);

  // Known protected active events
  const PROTECTED_KEYS = ['EK06', 'EK07', 'EK08'];
  const now = new Date('2026-09-06T16:00:00+05:30'); // Current local anchor date

  const eventMap = new Map();
  const classifiedEvents = [];

  for (const ev of allEvents) {
    let classification = 'ARCHIVE_CANDIDATE';
    let isProtected = false;
    let isReviewRequired = false;

    // Determine event key (e.g. EK06)
    let eventKey = `EK${String(ev.sequenceNumber || 0).padStart(2, '0')}`;
    if (ev.name && ev.name.includes('EK0')) {
      const match = ev.name.match(/EK0[1-9]/);
      if (match) eventKey = match[0];
    }

    // Parse date if possible
    let eventDateObj = null;
    if (ev.date && ev.date !== 'Date TBA' && ev.date !== 'TBD') {
      const parsed = new Date(ev.date);
      if (!isNaN(parsed.getTime())) {
        eventDateObj = parsed;
      }
    }

    // Check if explicitly protected
    if (PROTECTED_KEYS.includes(eventKey) || ev.id === 'prog-2026-09-07' || ev.id === 'prog-2026-09-11' || ev.id === 'prog-2026-09-19') {
      classification = 'PROTECTED_ACTIVE';
      isProtected = true;
    } else if (eventDateObj && eventDateObj > now) {
      classification = 'UNEXPECTED_ACTIVE_EVENT (PROTECTED)';
      isProtected = true;
    } else if (ev.status === 'upcoming' || ev.status === 'few_seats') {
      classification = 'UNEXPECTED_ACTIVE_EVENT (PROTECTED)';
      isProtected = true;
    } else if (ev.status === 'date_tba' || !ev.date || ev.date === 'Date TBA' || ev.date === 'TBD') {
      classification = 'REVIEW_REQUIRED';
      isReviewRequired = true;
    } else if (ev.status === 'housefull' && (!eventDateObj || eventDateObj > now)) {
      classification = 'REVIEW_REQUIRED';
      isReviewRequired = true;
    } else {
      classification = 'ARCHIVE_CANDIDATE';
    }

    const eventRecord = {
      id: ev.id,
      sequence: ev.sequenceNumber,
      key: eventKey,
      name: ev.name,
      date: ev.date || 'TBD',
      status: ev.status,
      classification,
      isProtected,
      isReviewRequired,
      archiveStatus: ev.archiveStatus || 'NOT_REQUIRED',
      // Stats placeholders
      registrationCount: 0,
      cloudinaryAssetsCount: 0,
      approxBytes: 0,
      driveArchivedCount: 0,
      verifiedArchivedCount: 0,
      deletedFromCloudinaryCount: 0,
      // Asset categories
      couplePhotos: 0,
      invitationCards: 0,
      paymentProofs: 0,
      thumbnails: 0
    };

    eventMap.set(ev.id, eventRecord);
    classifiedEvents.push(eventRecord);
  }

  // 3. Inspect MediaArchives
  console.log('\n====================================================');
  console.log('  3. MEDIA ARCHIVE AUDIT                            ');
  console.log('====================================================');
  const allArchives = await MediaArchive.find({}).lean();
  console.log(`Total MediaArchive records: ${allArchives.length}`);

  const archivesByEvent = new Map();
  for (const ma of allArchives) {
    if (!archivesByEvent.has(ma.eventId)) {
      archivesByEvent.set(ma.eventId, []);
    }
    archivesByEvent.get(ma.eventId).push(ma);

    const evRecord = eventMap.get(ma.eventId);
    if (evRecord) {
      if (ma.driveFileId) evRecord.driveArchivedCount++;
      if (ma.status === 'VERIFIED') evRecord.verifiedArchivedCount++;
      if (ma.cloudinaryOriginalStatus === 'DELETED') evRecord.deletedFromCloudinaryCount++;
      if (ma.originalSize) evRecord.approxBytes += ma.originalSize;
    }
  }

  // 4. Inspect Registrations (Submissions)
  console.log('\n====================================================');
  console.log('  4. REGISTRATION (SUBMISSION) MEDIA AUDIT          ');
  console.log('====================================================');
  const allRegs = await Registration.find({}).select('inquiryId programId couplePhoto paymentScreenshot invitationCardUrl isVip status isDeleted frameExportStatus').lean();
  console.log(`Total Registrations found: ${allRegs.length}`);

  // Asset type breakdown across all registrations
  const mediaClassification = {
    COUPLE_RAW_PHOTO: 0,
    COUPLE_THUMBNAIL_STORED: 0,
    PERSONALIZED_INVITATION: 0,
    DIGITAL_PASS_IMAGE: 0,
    QR_IMAGE: 0,
    PAYMENT_PROOF: 0,
    EVENT_GALLERY: 0,
    FEEDBACK_MEDIA: 0,
    WHATSAPP_MEDIA: 0,
    REPORT_EXPORT: 0,
    FRAMED_PHOTO: 0,
    VIP_MEDIA: 0,
    LEGACY_MEDIA: 0,
    DUPLICATE_MEDIA: 0,
    ORPHAN_MEDIA: 0,
    UNKNOWN: 0
  };

  const seenPhotoUrls = new Map();
  const seenInviteUrls = new Map();
  const seenPaymentUrls = new Map();

  let unlinkedRegistrationsCount = 0;

  for (const reg of allRegs) {
    const evRecord = eventMap.get(reg.programId);
    if (evRecord) {
      evRecord.registrationCount++;
    } else {
      unlinkedRegistrationsCount++;
    }

    // Couple Photo
    if (reg.couplePhoto && reg.couplePhoto !== '/sample_couple.png') {
      if (isCloudinaryUrl(reg.couplePhoto)) {
        mediaClassification.COUPLE_RAW_PHOTO++;
        if (evRecord) {
          evRecord.cloudinaryAssetsCount++;
          evRecord.couplePhotos++;
        }
        if (reg.isVip) mediaClassification.VIP_MEDIA++;
        if (reg.frameExportStatus === 'EXPORTED') mediaClassification.FRAMED_PHOTO++;

        // Duplicate check
        if (seenPhotoUrls.has(reg.couplePhoto)) {
          mediaClassification.DUPLICATE_MEDIA++;
        } else {
          seenPhotoUrls.set(reg.couplePhoto, reg.inquiryId);
        }
      } else {
        mediaClassification.LEGACY_MEDIA++;
      }
    }

    // Invitation Card
    if (reg.invitationCardUrl) {
      if (isCloudinaryUrl(reg.invitationCardUrl)) {
        mediaClassification.PERSONALIZED_INVITATION++;
        if (evRecord) {
          evRecord.cloudinaryAssetsCount++;
          evRecord.invitationCards++;
        }
        if (seenInviteUrls.has(reg.invitationCardUrl)) {
          mediaClassification.DUPLICATE_MEDIA++;
        } else {
          seenInviteUrls.set(reg.invitationCardUrl, reg.inquiryId);
        }
      }
    }

    // Payment Proof / Screenshot
    if (reg.paymentScreenshot) {
      if (isCloudinaryUrl(reg.paymentScreenshot)) {
        mediaClassification.PAYMENT_PROOF++;
        if (evRecord) {
          evRecord.cloudinaryAssetsCount++;
          evRecord.paymentProofs++;
        }
        if (seenPaymentUrls.has(reg.paymentScreenshot)) {
          mediaClassification.DUPLICATE_MEDIA++;
        } else {
          seenPaymentUrls.set(reg.paymentScreenshot, reg.inquiryId);
        }
      }
    }
  }

  // Count stored operational thumbnails from MediaArchive
  const storedThumbnails = allArchives.filter(a => a.operationalThumbnailPublicId || a.operationalThumbnailUrl);
  mediaClassification.COUPLE_THUMBNAIL_STORED = storedThumbnails.length;

  // 5. Inspect Passes
  const totalPasses = await Pass.countDocuments({});
  mediaClassification.QR_IMAGE = totalPasses; // QR tokens issued

  // 6. Inspect WhatsApp Messages
  const whatsappMediaMsgs = await WhatsappMessage.find({
    mediaUrl: { $exists: true, $ne: null, $ne: '' }
  }).select('messageId eventId inquiryId mediaUrl contentType').lean();

  for (const wm of whatsappMediaMsgs) {
    if (isCloudinaryUrl(wm.mediaUrl)) {
      mediaClassification.WHATSAPP_MEDIA++;
    }
  }

  // 7. Inspect Event Galleries / Hero / Poster images
  for (const ev of allEvents) {
    if (isCloudinaryUrl(ev.heroImage)) mediaClassification.EVENT_GALLERY++;
    if (isCloudinaryUrl(ev.posterImage)) mediaClassification.EVENT_GALLERY++;
    if (isCloudinaryUrl(ev.speakerImage)) mediaClassification.EVENT_GALLERY++;
  }

  // 8. Output Candidate Events Table
  console.log('\n====================================================');
  console.log('  5. CANDIDATE EVENTS TABLE                         ');
  console.log('====================================================');
  console.table(classifiedEvents.map(e => ({
    'Event ID': e.id,
    'Seq': e.sequence,
    'Date': e.date,
    'Status': e.status,
    'Regs': e.registrationCount,
    'Cloudinary Assets': e.cloudinaryAssetsCount,
    'Approx MB': (e.approxBytes / (1024 * 1024)).toFixed(1),
    'Drive Verified': e.verifiedArchivedCount,
    'Cld Deleted': e.deletedFromCloudinaryCount,
    'Classification': e.classification
  })));

  // 9. Output Media Classification Summary
  console.log('\n====================================================');
  console.log('  6. ASSET CLASSIFICATION SUMMARY                  ');
  console.log('====================================================');
  console.table(Object.entries(mediaClassification).map(([category, count]) => ({
    'Asset Category': category,
    'Asset Count': count
  })));

  console.log('\nUnlinked Registrations (no matching Event ID):', unlinkedRegistrationsCount);

  await mongoose.disconnect();
  console.log('\nInventory complete. Disconnected.');
}

runInventory().catch(err => {
  console.error('Inventory Error:', err);
  process.exit(1);
});
