import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import sharp from 'sharp';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { r2Provider } from '../src/integrations/r2/r2.provider.js';
import { invitationCardService } from '../src/services/invitationCard.service.js';

async function main() {
  console.log('Connecting to Prod MongoDB...');
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log('Connected to Prod MongoDB.');

  const event = await Event.findOne({ id: 'prog-2026-09-07' }).lean();
  if (!event) {
    console.error('Event prog-2026-09-07 not found!');
    process.exit(1);
  }

  const startSeq = 59;
  const endSeq = 92;
  const inquiryIds = [];
  for (let i = startSeq; i <= endSeq; i++) {
    inquiryIds.push(`EK06-IP-${i}`);
  }

  console.log(`Processing ${inquiryIds.length} VIP registrations (${inquiryIds[0]} to ${inquiryIds[inquiryIds.length - 1]})...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < inquiryIds.length; i++) {
    const inquiryId = inquiryIds[i];
    console.log(`[${i + 1}/${inquiryIds.length}] Upgrading media for ${inquiryId}...`);

    try {
      const reg = await Registration.findOne({ inquiryId });
      if (!reg) {
        console.warn(`  ⚠️ Registration ${inquiryId} not found in DB!`);
        failCount++;
        continue;
      }

      // 1. Fetch existing public R2 couple photo buffer
      const publicPhotoKey = `prod/events/EK06/registrations/${inquiryId}/couple/photo.jpg`;
      let originalBuf = null;
      try {
        originalBuf = await r2Provider.getObjectBuffer({
          bucket: r2Provider.publicBucket,
          key: publicPhotoKey
        });
      } catch (r2Err) {
        console.warn(`  ⚠️ Could not read ${publicPhotoKey} from public R2:`, r2Err.message);
      }

      if (!originalBuf) {
        console.error(`  ❌ Failed to get photo buffer for ${inquiryId}`);
        failCount++;
        continue;
      }

      // 2. Generate Sharp WebP variants
      const [thumbBuf, normBuf, largeBuf] = await Promise.all([
        sharp(originalBuf).rotate().resize(240, null, { withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer(),
        sharp(originalBuf).rotate().resize(720, null, { withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer(),
        sharp(originalBuf).rotate().resize(1200, null, { withoutEnlargement: true }).webp({ quality: 85, effort: 4 }).toBuffer()
      ]);

      // 3. Define target keys in private R2 bucket
      const opaqueMediaId = crypto.randomBytes(16).toString('hex');
      const baseKey = `prod/events/EK06/registrations/${inquiryId}/couple/${opaqueMediaId}`;
      const thumbKey = `${baseKey}/thumb.webp`;
      const normalKey = `${baseKey}/normal.webp`;
      const largeKey = `${baseKey}/large.webp`;

      // 4. Upload WebP variants directly to private R2 bucket
      await Promise.all([
        r2Provider.putObject({ bucket: r2Provider.privateBucket, key: thumbKey, body: thumbBuf, contentType: 'image/webp', cacheControl: 'private, max-age=3600, no-transform' }),
        r2Provider.putObject({ bucket: r2Provider.privateBucket, key: normalKey, body: normBuf, contentType: 'image/webp', cacheControl: 'private, max-age=3600, no-transform' }),
        r2Provider.putObject({ bucket: r2Provider.privateBucket, key: largeKey, body: largeBuf, contentType: 'image/webp', cacheControl: 'private, max-age=3600, no-transform' })
      ]);

      // 5. Update Registration document
      const publicPhotoUrl = `https://pub-b443f0b5d5cd4f0e854c148656b56760.r2.dev/${publicPhotoKey}`;
      reg.r2Media = {
        status: 'R2_PRIMARY',
        bucket: r2Provider.privateBucket,
        isPrivate: true,
        key: normalKey,
        thumbKey,
        normalKey,
        largeKey,
        thumbUrl: publicPhotoUrl,
        normalUrl: publicPhotoUrl,
        largeUrl: publicPhotoUrl,
        verifiedAt: new Date()
      };
      reg.couplePhoto = `/api/media/${inquiryId}/couple-photo?preset=normal`;
      reg.mediaProvider = 'R2';

      await reg.save();
      console.log(`  ✓ Updated r2Media & couplePhoto for ${inquiryId}`);

      // 6. Regenerate Invitation Card Composite with the updated r2Media
      try {
        const cardRes = await invitationCardService.ensureInvitationCardImage(reg, event);
        if (cardRes && cardRes.cardUrl) {
          reg.invitationCardUrl = cardRes.cardUrl;
          await reg.save();
          console.log(`  ✓ Regenerated Invitation Card: ${cardRes.cardUrl}`);
        }
      } catch (cardErr) {
        console.warn(`  ⚠️ Card regeneration warning for ${inquiryId}:`, cardErr.message);
      }

      successCount++;
    } catch (err) {
      console.error(`  ❌ Error processing ${inquiryId}:`, err);
      failCount++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`UPGRADE COMPLETE: ${successCount} succeeded, ${failCount} failed.`);
  console.log(`======================================================`);
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
