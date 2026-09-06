import { v2 as cloudinary } from 'cloudinary';
import { env } from '../src/config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
  secure: true
});

async function countFolder(prefix) {
  let count = 0;
  let bytes = 0;
  let next_cursor = null;
  do {
    const res = await cloudinary.api.resources({
      type: 'upload',
      prefix,
      max_results: 500,
      next_cursor
    });
    count += res.resources.length;
    bytes += res.resources.reduce((sum, r) => sum + (r.bytes || 0), 0);
    next_cursor = res.next_cursor;
  } while (next_cursor);
  return { count, bytes };
}

async function run() {
  const folders = ['couplePhotos', 'invitation-cards', 'paymentScreenshots', 'archive-thumbnails', 'event-assets', 'event-templates', 'samples', 'test_folder'];
  let totalCount = 0;
  let totalBytes = 0;
  for (const f of folders) {
    try {
      const res = await countFolder(f);
      console.log(`${f.padEnd(22)}: ${String(res.count).padStart(5)} assets, ${(res.bytes / (1024 * 1024)).toFixed(2).padStart(8)} MB`);
      totalCount += res.count;
      totalBytes += res.bytes;
    } catch (e) {
      console.log(`${f} error: ${e.message}`);
    }
  }
  console.log('----------------------------------------------------');
  console.log(`TOTAL COUNTED         : ${String(totalCount).padStart(5)} assets, ${(totalBytes / (1024 * 1024)).toFixed(2).padStart(8)} MB (${(totalBytes / (1024 * 1024 * 1024)).toFixed(3)} GB)`);
}

run();
