import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { Registration } from '../src/models/Registration.js';
import { env } from '../src/config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const PROD_MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

const PROTECTED_EVENTS = new Set(['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-19']);
const PROTECTED_PREFIXES = ['EK06-', 'EK07-', 'EK08-'];

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('================================================================');
  console.log(`  SAFE CLOUDINARY CLEANUP (${isDryRun ? 'DRY RUN' : 'LIVE EXECUTION'})`);
  console.log('================================================================');

  await mongoose.connect(PROD_MONGO_URI);
  console.log('Connected to Production MongoDB.');

  // 1. Fetch initial Cloudinary usage
  console.log('\n--- INITIAL CLOUDINARY USAGE ---');
  try {
    const initialUsage = await cloudinary.api.usage();
    console.log(`Storage: ${(initialUsage.storage.usage / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Credits: ${initialUsage.credits.usage} / ${initialUsage.credits.limit} (${initialUsage.credits.used_percent}%)`);
    console.log(`Objects: ${initialUsage.resources}`);
  } catch (e) {
    console.warn('Could not fetch initial Cloudinary usage:', e.message);
  }

  // 2. Fetch all verified past-event MediaArchive records
  const candidates = await MediaArchive.find({
    status: { $in: ['VERIFIED', 'ARCHIVED'] },
    driveFileId: { $exists: true, $ne: null, $ne: '' },
    cloudinaryOriginalStatus: { $ne: 'DELETED' }
  }).lean();

  console.log(`\nFound ${candidates.length} candidate verified archive records in DB.`);

  // 3. Strict Safety Filtering
  const toDelete = [];
  const skipped = [];

  for (const item of candidates) {
    // Check 1: Exclude protected upcoming events
    if (PROTECTED_EVENTS.has(item.eventId)) {
      skipped.push({ id: item.registrationId, reason: `Belongs to protected upcoming event ${item.eventId}` });
      continue;
    }

    // Check 2: Exclude protected inquiry ID prefixes
    const isInquiryProtected = PROTECTED_PREFIXES.some(p => item.registrationId && item.registrationId.startsWith(p));
    if (isInquiryProtected) {
      skipped.push({ id: item.registrationId, reason: `Protected inquiry prefix (${item.registrationId})` });
      continue;
    }

    // Check 3: Reject mock/test drive IDs
    const driveId = String(item.driveFileId || '');
    if (driveId.startsWith('1AbCdEfGh') || driveId.toLowerCase().includes('mock') || driveId.toLowerCase().includes('test')) {
      skipped.push({ id: item.registrationId, reason: `Mock Drive ID (${driveId})` });
      continue;
    }

    // Determine Cloudinary full public_id
    let fullPublicId = item.sourcePublicId;
    if (item.sourceUrl && item.sourceUrl.includes('/couplePhotos/')) {
      if (!fullPublicId.startsWith('couplePhotos/')) {
        fullPublicId = `couplePhotos/${fullPublicId}`;
      }
    }

    toDelete.push({
      archiveId: item._id,
      registrationId: item.registrationId,
      eventId: item.eventId,
      driveFileId: item.driveFileId,
      sourcePublicId: item.sourcePublicId,
      fullPublicId,
      sourceUrl: item.sourceUrl,
      sizeBytes: item.originalSize || 0
    });
  }

  console.log(`Eligible for Cloudinary deletion (Drive verified): ${toDelete.length}`);
  console.log(`Skipped by safety filters: ${skipped.length}`);

  if (skipped.length > 0) {
    console.log('Sample skipped items:', skipped.slice(0, 5));
  }

  // Safety Assertion: ZERO upcoming items can be in toDelete
  const violation = toDelete.find(d => 
    PROTECTED_EVENTS.has(d.eventId) || 
    PROTECTED_PREFIXES.some(p => d.registrationId && d.registrationId.startsWith(p))
  );

  if (violation) {
    console.error('FATAL SAFETY VIOLATION DETECTED:', violation);
    process.exit(1);
  }
  console.log('✅ Safety verification passed: ZERO upcoming event assets in deletion queue.');

  const totalBytesFreedEstimate = toDelete.reduce((acc, cur) => acc + cur.sizeBytes, 0);
  console.log(`Estimated Storage to be freed: ${(totalBytesFreedEstimate / (1024 * 1024)).toFixed(2)} MB`);

  if (isDryRun) {
    console.log('\n[DRY RUN COMPLETE] No assets were deleted.');
    process.exit(0);
  }

  // 4. LIVE DELETION OF CONFIRMED VERIFIED ASSETS
  console.log('\n--- EXECUTING LIVE CLOUDINARY CLEANUP ---');
  let deletedCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;
  const deletedArchiveIds = [];

  // Batch delete in chunks of 50
  const CHUNK_SIZE = 50;
  for (let i = 0; i < toDelete.length; i += CHUNK_SIZE) {
    const chunk = toDelete.slice(i, i + CHUNK_SIZE);
    const publicIds = chunk.map(c => c.fullPublicId);

    try {
      const deleteResult = await cloudinary.api.delete_resources(publicIds, {
        resource_type: 'image',
        type: 'upload'
      });

      for (const item of chunk) {
        const status = deleteResult.deleted ? deleteResult.deleted[item.fullPublicId] : null;
        if (status === 'deleted') {
          deletedCount++;
          deletedArchiveIds.push(item.archiveId);
        } else if (status === 'not_found') {
          notFoundCount++;
          deletedArchiveIds.push(item.archiveId); // already deleted or unreferenced
        } else {
          console.warn(`[${item.registrationId}] Delete status:`, status);
          deletedArchiveIds.push(item.archiveId);
        }
      }

      process.stdout.write(`Processed ${Math.min(i + CHUNK_SIZE, toDelete.length)} / ${toDelete.length}...\r`);
    } catch (chunkErr) {
      console.error(`Chunk delete error at index ${i}:`, chunkErr.message);
      // Fallback to individual delete
      for (const item of chunk) {
        try {
          const res = await cloudinary.uploader.destroy(item.fullPublicId);
          if (res.result === 'ok' || res.result === 'not found') {
            deletedCount++;
            deletedArchiveIds.push(item.archiveId);
          } else {
            errorCount++;
          }
        } catch (e) {
          errorCount++;
        }
      }
    }
  }

  console.log(`\nCloudinary Cleanup Results:`);
  console.log(`- Successfully deleted from Cloudinary: ${deletedCount}`);
  console.log(`- Not found / already cleaned: ${notFoundCount}`);
  console.log(`- Errors: ${errorCount}`);

  // 5. Update MediaArchive Records in Production DB
  console.log('\nUpdating MediaArchive ledger in MongoDB...');
  if (deletedArchiveIds.length > 0) {
    const updateResult = await MediaArchive.updateMany(
      { _id: { $in: deletedArchiveIds } },
      {
        $set: {
          cloudinaryOriginalStatus: 'DELETED',
          cloudinaryOriginalDeletedAt: new Date()
        }
      }
    );
    console.log(`Updated ${updateResult.modifiedCount} MediaArchive records to 'DELETED'.`);
  }

  // 6. Clean up Cloudinary default samples/ stock photos
  console.log('\n--- CLEANING UNUSED SAMPLES FOLDER ---');
  try {
    const sampleResources = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'samples/',
      max_results: 100
    });
    if (sampleResources.resources.length > 0) {
      const sampleIds = sampleResources.resources.map(r => r.public_id);
      await cloudinary.api.delete_resources(sampleIds);
      console.log(`Deleted ${sampleIds.length} unused stock sample photos from Cloudinary.`);
    } else {
      console.log('No samples found to delete.');
    }
  } catch (sampleErr) {
    console.warn('Samples cleanup warning:', sampleErr.message);
  }

  // 7. Check Final Cloudinary Usage
  console.log('\n--- FINAL CLOUDINARY USAGE ---');
  try {
    const finalUsage = await cloudinary.api.usage();
    console.log(`Storage: ${(finalUsage.storage.usage / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Credits: ${finalUsage.credits.usage} / ${finalUsage.credits.limit} (${finalUsage.credits.used_percent}%)`);
    console.log(`Objects: ${finalUsage.resources}`);
  } catch (e) {
    console.warn('Could not fetch final Cloudinary usage:', e.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error during cleanup:', err);
  process.exit(1);
});
