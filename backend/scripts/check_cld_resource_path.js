import { v2 as cloudinary } from 'cloudinary';
import { env } from '../src/config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
  secure: true
});

async function main() {
  const sampleId = 'qtvio4ax64xvmhidezvp';
  console.log(`Checking resource "${sampleId}" vs "couplePhotos/${sampleId}"...`);

  try {
    const resWithoutFolder = await cloudinary.api.resource(sampleId);
    console.log('Found without folder:', resWithoutFolder.public_id);
  } catch (e) {
    console.log('Without folder failed:', e.message);
  }

  try {
    const resWithFolder = await cloudinary.api.resource(`couplePhotos/${sampleId}`);
    console.log('Found with folder:', resWithFolder.public_id, 'bytes:', resWithFolder.bytes);
  } catch (e) {
    console.log('With folder failed:', e.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
