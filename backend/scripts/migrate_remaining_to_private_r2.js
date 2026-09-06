import mongoose from 'mongoose';
import crypto from 'crypto';
import sharp from 'sharp';
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

async function fetchBufferFromUrl(url) {
  let targetUrl = url;
  if (url.includes('cloudinary.com') && /\.(heic|heif)$/i.test(url)) {
    targetUrl = url
      .replace(/\/upload\//, '/upload/f_jpg/')
      .replace(/\.(heic|heif)$/i, '.jpg');
  }

  let res = await fetch(targetUrl);
  if (!res.ok && targetUrl !== url) {
    targetUrl = url;
    res = await fetch(targetUrl);
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch image from ${targetUrl}: HTTP ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function migrateRemainingToPrivateR2() {
  const args = parseArgs();
  const isProd = Boolean(args.prod);
  const isDryRun = Boolean(args.dryRun || args['dry-run']);

  console.log('====================================================');
  console.log('EDKL COMPREHENSIVE PRIVATE R2 MIGRATION & REPAIR');
  console.log(`Mode:            ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`Execution:       ${isDryRun ? 'DRY RUN (No writes)' : 'LIVE EXECUTION'}`);
  console.log(`Private Target:  ${env.R2_PRIVATE_BUCKET}`);
  console.log('====================================================');

  const targetUri = isProd
    ? (process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || process.env.MONGO_URI)
    : (process.env.MONGO_URI || env.MONGO_URI);

  await mongoose.connect(targetUri);
  console.log(`Connected to MongoDB: ${mongoose.connection.db.databaseName}`);

  // Query all registrations for upcoming events (EK06, EK07, EK08)
  const eventRegex = /^EK0[6-8]/;
  const allRegs = await Registration.find({
    $or: [
      { inquiryId: { $regex: eventRegex } },
      { programName: { $regex: /september/i } }
    ]
  }).sort({ inquiryId: 1 }).lean();

  console.log(`Total upcoming registrations retrieved: ${allRegs.length}`);

  const candidates = [];

  for (const reg of allRegs) {
    const rawPhoto = reg.couplePhoto || '';
    const r2Media = reg.r2Media;

    // Skip sample fallback
    if (rawPhoto === '/sample_couple.png' || rawPhoto.includes('sample_couple.png')) {
      continue;
    }

    // Check if record needs migration or repair
    const isAlreadyPrivate = r2Media?.isPrivate === true &&
      r2Media?.status === 'R2_PRIMARY' &&
      r2Media?.bucket === env.R2_PRIVATE_BUCKET &&
      Boolean(r2Media?.thumbKey) &&
      Boolean(r2Media?.normalKey) &&
      Boolean(r2Media?.largeKey);

    if (!isAlreadyPrivate) {
      candidates.push(reg);
    }
  }

  console.log(`Found ${candidates.length} records requiring private R2 migration or repair:`);
  candidates.forEach(c => {
    console.log(`  - [${c.inquiryId}] provider=${c.mediaProvider}, r2Status=${c.r2Media?.status}, photo=${c.couplePhoto?.slice(0, 70)}...`);
  });

  if (candidates.length === 0) {
    console.log('\n[SUCCESS] All records are already 100% in private R2 with verified WebP variants!');
    await mongoose.disconnect();
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const reg = candidates[i];
    const inquiryId = reg.inquiryId;
    const rawPhoto = reg.couplePhoto || '';
    const r2Media = reg.r2Media;

    console.log(`\n[${i + 1}/${candidates.length}] Processing ${inquiryId}...`);

    try {
      // 1. Resolve event key (EK06, EK07, EK08)
      let eventKey = 'EK06';
      if (inquiryId.startsWith('EK07')) eventKey = 'EK07';
      else if (inquiryId.startsWith('EK08')) eventKey = 'EK08';
      else if (inquiryId.startsWith('EK06')) eventKey = 'EK06';

      // 2. Fetch original buffer
      let originalBuffer = null;
      let publicR2KeyToDelete = null;

      // Check if image is stored in public R2
      if (rawPhoto.includes('media.ekdujekeliye.in') || (r2Media?.bucket === env.R2_PUBLIC_BUCKET && r2Media?.key)) {
        const publicKey = r2Media?.key || rawPhoto.replace(/^https?:\/\/[^/]+\//, '');
        console.log(`  Fetching from public R2 bucket: ${publicKey}`);
        try {
          originalBuffer = await r2Provider.getObjectBuffer({
            bucket: env.R2_PUBLIC_BUCKET,
            key: publicKey
          });
          publicR2KeyToDelete = publicKey;
        } catch (e) {
          console.warn(`  Could not fetch from public R2 (${e.message}), trying alternative sources...`);
        }
      }

      // If not fetched from public R2, check if public R2 has couplePhotos/${inquiryId}_couple.jpg
      if (!originalBuffer) {
        const possiblePublicKey = `couplePhotos/${inquiryId}_couple.jpg`;
        const headCheck = await r2Provider.headObject({ bucket: env.R2_PUBLIC_BUCKET, key: possiblePublicKey });
        if (headCheck.exists) {
          console.log(`  Found in public R2: ${possiblePublicKey}`);
          originalBuffer = await r2Provider.getObjectBuffer({
            bucket: env.R2_PUBLIC_BUCKET,
            key: possiblePublicKey
          });
          publicR2KeyToDelete = possiblePublicKey;
        }
      }

      // If still not fetched, fetch from Cloudinary
      if (!originalBuffer && rawPhoto.includes('cloudinary.com')) {
        console.log(`  Fetching from Cloudinary: ${rawPhoto}`);
        originalBuffer = await fetchBufferFromUrl(rawPhoto);
      }

      // Check existing private key if partially set
      if (!originalBuffer && r2Media?.key && r2Media?.bucket === env.R2_PRIVATE_BUCKET) {
        console.log(`  Fetching existing private key: ${r2Media.key}`);
        originalBuffer = await r2Provider.getObjectBuffer({
          bucket: env.R2_PRIVATE_BUCKET,
          key: r2Media.key
        });
      }

      if (!originalBuffer || originalBuffer.length === 0) {
        throw new Error(`Could not obtain image buffer from any source for ${inquiryId}`);
      }

      console.log(`  Acquired buffer: ${originalBuffer.length} bytes`);

      // 3. Generate WebP variants via Sharp
      const [thumbBuf, normBuf, largeBuf] = await Promise.all([
        sharp(originalBuffer)
          .rotate()
          .resize(240, null, { withoutEnlargement: true })
          .webp({ quality: 80, effort: 4 })
          .toBuffer(),
        sharp(originalBuffer)
          .rotate()
          .resize(720, null, { withoutEnlargement: true })
          .webp({ quality: 82, effort: 4 })
          .toBuffer(),
        sharp(originalBuffer)
          .rotate()
          .resize(1200, null, { withoutEnlargement: true })
          .webp({ quality: 85, effort: 4 })
          .toBuffer()
      ]);

      console.log(`  Generated WebP variants: thumb=${thumbBuf.length}b, norm=${normBuf.length}b, large=${largeBuf.length}b`);

      const opaqueMediaId = crypto.randomBytes(16).toString('hex');
      const baseKey = `prod/events/${eventKey}/registrations/${inquiryId}/couple/${opaqueMediaId}`;
      const thumbKey = `${baseKey}/thumb.webp`;
      const normalKey = `${baseKey}/normal.webp`;
      const largeKey = `${baseKey}/large.webp`;

      if (isDryRun) {
        console.log(`  [DRY RUN] Would write to private R2: ${normalKey}`);
        successCount++;
        continue;
      }

      // 4. Upload variants to edkl-private-media
      await Promise.all([
        r2Provider.putObject({
          bucket: env.R2_PRIVATE_BUCKET,
          key: thumbKey,
          body: thumbBuf,
          contentType: 'image/webp',
          cacheControl: 'private, max-age=3600, no-transform'
        }),
        r2Provider.putObject({
          bucket: env.R2_PRIVATE_BUCKET,
          key: normalKey,
          body: normBuf,
          contentType: 'image/webp',
          cacheControl: 'private, max-age=3600, no-transform'
        }),
        r2Provider.putObject({
          bucket: env.R2_PRIVATE_BUCKET,
          key: largeKey,
          body: largeBuf,
          contentType: 'image/webp',
          cacheControl: 'private, max-age=3600, no-transform'
        })
      ]);

      // 5. Verify existence via HEAD
      const [headT, headN, headL] = await Promise.all([
        r2Provider.headObject({ bucket: env.R2_PRIVATE_BUCKET, key: thumbKey }),
        r2Provider.headObject({ bucket: env.R2_PRIVATE_BUCKET, key: normalKey }),
        r2Provider.headObject({ bucket: env.R2_PRIVATE_BUCKET, key: largeKey })
      ]);

      if (!headT.exists || !headN.exists || !headL.exists) {
        throw new Error(`R2 HEAD verification failed for ${inquiryId}`);
      }

      // 6. Update MongoDB Registration document
      await Registration.updateOne(
        { inquiryId },
        {
          $set: {
            mediaProvider: 'R2',
            couplePhoto: `/api/media/${inquiryId}/couple-photo?preset=normal`,
            'r2Media.status': 'R2_PRIMARY',
            'r2Media.bucket': env.R2_PRIVATE_BUCKET,
            'r2Media.isPrivate': true,
            'r2Media.key': normalKey,
            'r2Media.thumbKey': thumbKey,
            'r2Media.normalKey': normalKey,
            'r2Media.largeKey': largeKey,
            'r2Media.verifiedAt': new Date()
          }
        }
      );

      console.log(`  [UPDATED] MongoDB registration ${inquiryId} updated to private R2_PRIMARY!`);

      // 7. Cleanup public R2 temporary object if present
      if (publicR2KeyToDelete) {
        try {
          await r2Provider.deleteObject({ bucket: env.R2_PUBLIC_BUCKET, key: publicR2KeyToDelete });
          console.log(`  [CLEANED] Deleted public temporary R2 object: ${publicR2KeyToDelete}`);
        } catch (delErr) {
          console.warn(`  Could not delete public R2 object ${publicR2KeyToDelete}:`, delErr.message);
        }
      }

      successCount++;
    } catch (itemErr) {
      console.error(`  [FAILED] ${inquiryId}:`, itemErr.message);
      failCount++;
    }
  }

  console.log('\n====================================================');
  console.log(`MIGRATION FINISHED: ${successCount} successful, ${failCount} failed.`);
  console.log('====================================================');

  await mongoose.disconnect();
}

migrateRemainingToPrivateR2().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
