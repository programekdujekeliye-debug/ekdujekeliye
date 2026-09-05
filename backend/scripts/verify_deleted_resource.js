import { v2 as cloudinary } from 'cloudinary';
import { env } from '../src/config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
  secure: true
});

async function main() {
  const sampleId = 'couplePhotos/qtvio4ax64xvmhidezvp';
  try {
    const res = await cloudinary.api.resource(sampleId);
    console.log(`Resource ${sampleId} still exists:`, res.public_id);
  } catch (err) {
    console.log(`Resource ${sampleId} is DELETED:`, err.message);
  }

  // Count current resources in couplePhotos
  let totalCouplePhotos = 0;
  let nextCursor = null;
  do {
    const r = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'couplePhotos',
      max_results: 500,
      next_cursor: nextCursor
    });
    totalCouplePhotos += r.resources.length;
    nextCursor = r.next_cursor;
  } while (nextCursor);

  console.log(`Remaining resources in couplePhotos folder: ${totalCouplePhotos}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
