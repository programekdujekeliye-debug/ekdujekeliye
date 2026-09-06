/**
 * Deep inspection of Cloudinary folders and resource types
 */
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../src/config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
  secure: true
});

async function main() {
  console.log('--- CLOUDINARY ROOT FOLDERS ---');
  try {
    const foldersRes = await cloudinary.api.root_folders();
    console.log('Folders:', foldersRes.folders);
  } catch (err) {
    console.error('root_folders error:', err.message);
  }

  console.log('\n--- CLOUDINARY SUBFOLDERS IN ekdujekeliye ---');
  try {
    const subfolders = await cloudinary.api.sub_folders('ekdujekeliye');
    console.log('ekdujekeliye subfolders:', subfolders.folders);
  } catch (err) {
    console.log('No ekdujekeliye subfolders:', err.message);
  }

  // Count resources by common prefixes
  const prefixes = [
    'couplePhotos',
    'couplePhotos/originals',
    'couplePhotos/compressed',
    'invitation-cards',
    'paymentScreenshots',
    'event-assets',
    'event-templates',
    'archive-thumbnails',
    'edkl-prod',
    'edkl-test',
    'ekdujekeliye',
    'whatsapp'
  ];

  console.log('\n--- SAMPLE RESOURCE COUNTS BY PREFIX ---');
  for (const prefix of prefixes) {
    try {
      const res = await cloudinary.api.resources({
        type: 'upload',
        prefix,
        max_results: 5
      });
      console.log(`Prefix "${prefix}": found >= ${res.resources.length} (has_more: ${Boolean(res.next_cursor)})`);
      if (res.resources.length > 0) {
        console.log(`   Sample: ${res.resources[0].public_id} (${(res.resources[0].bytes / 1024).toFixed(1)} KB, format: ${res.resources[0].format})`);
      }
    } catch (err) {
      console.log(`Prefix "${prefix}": ${err.message}`);
    }
  }

  // Also check root un-prefixed assets
  try {
    const rootRes = await cloudinary.api.resources({
      type: 'upload',
      max_results: 10
    });
    console.log('\n--- FIRST 10 ROOT ASSETS IN CLOUDINARY ---');
    for (const r of rootRes.resources) {
      console.log(`- ${r.public_id} (${(r.bytes / 1024).toFixed(1)} KB, folder: ${r.asset_folder || r.folder || 'none'})`);
    }
  } catch (err) {
    console.error('root resources error:', err.message);
  }
}

main().catch(console.error);
