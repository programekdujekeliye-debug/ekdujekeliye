import mongoose from 'mongoose';
import crypto from 'crypto';
import { Registration } from '../src/models/Registration.js';
import { r2Provider } from '../src/integrations/r2/r2.provider.js';
import { env } from '../src/config/env.js';

const parseArgs = () => {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, val] = arg.replace(/^--/, '').split('=');
      args[key] = val !== undefined ? val : true;
    }
  });
  return args;
};

async function migrateCouplePhotosToPrivateR2() {
  const args = parseArgs();
  const limit = args.limit !== undefined ? parseInt(args.limit, 10) : 5;
  const dryRun = Boolean(args.dryRun);

  console.log('====================================================');
  console.log('EDKL COUPLE PHOTO PRIVACY MIGRATION: PUBLIC -> PRIVATE R2');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE EXECUTION'}`);
  console.log(`Limit: ${limit === 0 ? 'ALL RECORDS' : limit}`);
  console.log(`Public Source Bucket: ${env.R2_PUBLIC_BUCKET}`);
  console.log(`Private Target Bucket: ${env.R2_PRIVATE_BUCKET}`);
  console.log('====================================================');

  const isProd = Boolean(args.prod);
  const targetUri = isProd
    ? (process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || process.env.MONGO_URI)
    : (process.env.MONGO_URI || env.MONGO_URI);

  await mongoose.connect(targetUri);
  console.log(`Connected to MongoDB: ${mongoose.connection.db.databaseName}`);

  // Query records that have couple photos in public R2 bucket
  const query = {
    $or: [
      { 'r2Media.bucket': env.R2_PUBLIC_BUCKET },
      { 'r2Media.isPrivate': { $ne: true }, 'r2Media.status': 'R2_PRIMARY' }
    ],
    'r2Media.key': { $exists: true, $ne: null }
  };

  const totalEligible = await Registration.countDocuments(query);
  console.log(`Total public couple photo records eligible for privacy migration: ${totalEligible}`);

  if (totalEligible === 0) {
    console.log('No public couple photo records require migration. All are already private!');
    await mongoose.disconnect();
    return;
  }

  let cursor = Registration.find(query).sort({ updatedAt: -1 });
  if (limit > 0) {
    cursor = cursor.limit(limit);
  }

  const records = await cursor;
  console.log(`Processing batch of ${records.length} records...`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < records.length; i++) {
    const reg = records[i];
    const inquiryId = reg.inquiryId;
    const oldKey = reg.r2Media.key;

    try {
      // Derive old keys
      const oldNormalKey = oldKey;
      const oldThumbKey = oldKey.replace('/normal.webp', '/thumb.webp');
      const oldLargeKey = oldKey.replace('/normal.webp', '/large.webp');

      // Resolve event key accurately (e.g. EK06, EK07, EK08)
      let eventKey = 'EK06';
      if (inquiryId && inquiryId.startsWith('EK07')) eventKey = 'EK07';
      else if (inquiryId && inquiryId.startsWith('EK08')) eventKey = 'EK08';
      else if (inquiryId && inquiryId.startsWith('EK06')) eventKey = 'EK06';
      else if (oldKey.includes('prod/events/EK07/')) eventKey = 'EK07';
      else if (oldKey.includes('prod/events/EK08/')) eventKey = 'EK08';
      else if (oldKey.includes('prod/events/EK06/')) eventKey = 'EK06';

      // 128-bit opaque media identifier (Correction #2)
      const opaqueMediaId = crypto.randomBytes(16).toString('hex');

      // Build target private keys inside edkl-private-media (Correction #1)
      const targetBase = `prod/events/${eventKey}/registrations/${inquiryId}/couple/${opaqueMediaId}`;
      const newThumbKey = `${targetBase}/thumb.webp`;
      const newNormalKey = `${targetBase}/normal.webp`;
      const newLargeKey = `${targetBase}/large.webp`;

      if (dryRun) {
        console.log(`[DRY RUN] ${inquiryId}: Would copy ${oldNormalKey} -> ${newNormalKey}`);
        successCount++;
        continue;
      }

      // Helper for resilient retries against transient network/DNS drops
      const copyWithRetry = async (params) => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            return await r2Provider.copyObject(params);
          } catch (err) {
            if (attempt === 3) throw err;
            await new Promise(r => setTimeout(r, 400 * attempt));
          }
        }
      };

      // Step 1: Copy objects from public bucket to private bucket with retry
      await Promise.all([
        copyWithRetry({
          sourceBucket: env.R2_PUBLIC_BUCKET,
          sourceKey: oldThumbKey,
          targetBucket: env.R2_PRIVATE_BUCKET,
          targetKey: newThumbKey,
          contentType: 'image/webp'
        }),
        copyWithRetry({
          sourceBucket: env.R2_PUBLIC_BUCKET,
          sourceKey: oldNormalKey,
          targetBucket: env.R2_PRIVATE_BUCKET,
          targetKey: newNormalKey,
          contentType: 'image/webp'
        }),
        copyWithRetry({
          sourceBucket: env.R2_PUBLIC_BUCKET,
          sourceKey: oldLargeKey,
          targetBucket: env.R2_PRIVATE_BUCKET,
          targetKey: newLargeKey,
          contentType: 'image/webp'
        })
      ]);

      // Step 2: HEAD verify in private bucket
      const [headThumb, headNormal, headLarge] = await Promise.all([
        r2Provider.headObject({ bucket: env.R2_PRIVATE_BUCKET, key: newThumbKey }),
        r2Provider.headObject({ bucket: env.R2_PRIVATE_BUCKET, key: newNormalKey }),
        r2Provider.headObject({ bucket: env.R2_PRIVATE_BUCKET, key: newLargeKey })
      ]);

      if (!headThumb.exists || !headNormal.exists || !headLarge.exists) {
        throw new Error(`Private R2 HEAD check failed for ${inquiryId}`);
      }

      // Step 3: Verify application secure access (generate signed URL test)
      const testSignedUrl = await r2Provider.generatePresignedDownloadUrl({
        bucket: env.R2_PRIVATE_BUCKET,
        key: newNormalKey,
        expiresIn: 300
      });
      if (!testSignedUrl || !testSignedUrl.downloadUrl) {
        throw new Error('Failed to generate test signed URL for private object');
      }

      // Step 4: Update DB metadata (zero permanent public URLs)
      reg.r2Media = {
        status: 'R2_PRIMARY',
        bucket: env.R2_PRIVATE_BUCKET,
        isPrivate: true,
        key: newNormalKey,
        thumbKey: newThumbKey,
        normalKey: newNormalKey,
        largeKey: newLargeKey,
        thumbUrl: `/api/media/${inquiryId}/couple-photo?preset=thumb`,
        normalUrl: `/api/media/${inquiryId}/couple-photo?preset=normal`,
        largeUrl: `/api/media/${inquiryId}/couple-photo?preset=large`,
        cloudinaryFallbackUrl: reg.r2Media.cloudinaryFallbackUrl || null,
        verifiedAt: new Date()
      };
      await reg.save();

      // Step 5: Delete old public R2 objects now that private copy is verified
      await Promise.all([
        r2Provider.deleteObject({ bucket: env.R2_PUBLIC_BUCKET, key: oldThumbKey }),
        r2Provider.deleteObject({ bucket: env.R2_PUBLIC_BUCKET, key: oldNormalKey }),
        r2Provider.deleteObject({ bucket: env.R2_PUBLIC_BUCKET, key: oldLargeKey })
      ]);

      // Small pacing delay between records to ensure socket reuse and DNS stability
      await new Promise(r => setTimeout(r, 40));

      successCount++;
      if ((i + 1) % 10 === 0 || i === records.length - 1) {
        console.log(`[Progress] Migrated ${i + 1}/${records.length} couple photos to private R2.`);
      }
    } catch (err) {
      failCount++;
      console.error(`[Error] Failed migrating ${inquiryId}:`, err.message);
    }
  }

  console.log('====================================================');
  console.log('MIGRATION PILOT / BATCH SUMMARY:');
  console.log(`Successfully migrated to private R2: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('====================================================');

  await mongoose.disconnect();
}

migrateCouplePhotosToPrivateR2().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
