import sharp from 'sharp';
import { r2Provider } from '../integrations/r2/r2.provider.js';
import { Registration } from '../models/Registration.js';

/**
 * Lightweight in-memory bounded queue for variant processing
 * Concurrency limit = 2, preventing RAM exhaustion on Render instances
 */
class MediaVariantWorker {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  enqueue(task) {
    this.queue.push(task);
    this.processNext();
  }

  async processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    this.running++;

    try {
      await this.executeTaskWithTimeout(task, 30000); // 30s timeout
    } catch (err) {
      console.error(`[MediaVariantWorker] Error processing task for ${task.inquiryId || task.opaqueMediaId}:`, err.message);
    } finally {
      this.running--;
      this.processNext();
    }
  }

  async executeTaskWithTimeout(task, timeoutMs) {
    return Promise.race([
      this.processVariants(task),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Processing timed out after 30s')), timeoutMs))
    ]);
  }

  async processVariants({ bucket, objectKey, eventId, inquiryId, opaqueMediaId, registrationId }) {
    console.log(`[MediaVariantWorker] Starting async variant generation for ${inquiryId || opaqueMediaId}...`);

    const targetBucket = bucket || r2Provider.privateBucket;

    // 1. Fetch original from R2
    const originalBuffer = await r2Provider.getObjectBuffer({
      bucket: targetBucket,
      key: objectKey
    });

    if (!originalBuffer || originalBuffer.length === 0) {
      throw new Error(`Original image buffer is empty for ${objectKey}`);
    }

    // 2. MIME & image integrity validation via Sharp
    const image = sharp(originalBuffer);
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || !metadata.format) {
      throw new Error(`Invalid or corrupt image content: format=${metadata.format}`);
    }

    const allowedFormats = ['jpeg', 'png', 'webp', 'heif'];
    if (!allowedFormats.includes(metadata.format.toLowerCase())) {
      throw new Error(`Unsupported image format: ${metadata.format}`);
    }

    // 3. Generate WebP variants (thumb: 240, normal: 720, large: 1200)
    const [thumbBuffer, normalBuffer, largeBuffer] = await Promise.all([
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

    // 4. Upload variants to private bucket (Couple photos MUST be private)
    const baseKey = `prod/events/${eventId}/registrations/${inquiryId}/couple/${opaqueMediaId}`;
    const thumbKey = `${baseKey}/thumb.webp`;
    const normalKey = `${baseKey}/normal.webp`;
    const largeKey = `${baseKey}/large.webp`;

    await Promise.all([
      r2Provider.putObject({
        bucket: targetBucket,
        key: thumbKey,
        body: thumbBuffer,
        contentType: 'image/webp',
        cacheControl: 'private, max-age=3600, no-transform'
      }),
      r2Provider.putObject({
        bucket: targetBucket,
        key: normalKey,
        body: normalBuffer,
        contentType: 'image/webp',
        cacheControl: 'private, max-age=3600, no-transform'
      }),
      r2Provider.putObject({
        bucket: targetBucket,
        key: largeKey,
        body: largeBuffer,
        contentType: 'image/webp',
        cacheControl: 'private, max-age=3600, no-transform'
      })
    ]);

    // 5. Verify variants exist via headObject
    const [headThumb, headNormal, headLarge] = await Promise.all([
      r2Provider.headObject({ bucket: targetBucket, key: thumbKey }),
      r2Provider.headObject({ bucket: targetBucket, key: normalKey }),
      r2Provider.headObject({ bucket: targetBucket, key: largeKey })
    ]);

    if (!headThumb.exists || !headNormal.exists || !headLarge.exists) {
      throw new Error(`Variant HEAD verification failed for ${opaqueMediaId}`);
    }

    // 6. Update MongoDB Registration if inquiryId or registrationId provided
    if (inquiryId || registrationId) {
      const query = inquiryId
        ? { inquiryId: { $regex: new RegExp(`^${inquiryId}$`, 'i') } }
        : { _id: registrationId };

      await Registration.updateOne(query, {
        $set: {
          'r2Media.status': 'R2_PRIMARY',
          'r2Media.bucket': targetBucket,
          'r2Media.isPrivate': true,
          'r2Media.key': objectKey,
          'r2Media.thumbKey': thumbKey,
          'r2Media.normalKey': normalKey,
          'r2Media.largeKey': largeKey,
          'r2Media.verifiedAt': new Date()
        }
      });
      console.log(`[MediaVariantWorker] Registration ${inquiryId || registrationId} successfully updated to R2_PRIMARY with private variants.`);
    }

    return {
      success: true,
      bucket: targetBucket,
      thumbKey,
      normalKey,
      largeKey
    };
  }
}

export const mediaVariantWorker = new MediaVariantWorker(2);
