import { v2 as cloudinary } from 'cloudinary';
import { env } from '../src/config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
  secure: true
});

async function main() {
  console.log('Analyzing Cloudinary storage distribution...');

  const folders = ['couplePhotos', 'invitation-cards', 'event-assets', 'event-templates', 'paymentScreenshots', 'archive-thumbnails', 'samples'];
  
  for (const folder of folders) {
    let count = 0;
    let totalBytes = 0;
    let nextCursor = null;

    do {
      const res = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: 500,
        next_cursor: nextCursor
      });

      count += res.resources.length;
      totalBytes += res.resources.reduce((acc, r) => acc + (r.bytes || 0), 0);
      nextCursor = res.next_cursor;
    } while (nextCursor);

    console.log(`Folder [${folder}]: ${count} resources, ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
