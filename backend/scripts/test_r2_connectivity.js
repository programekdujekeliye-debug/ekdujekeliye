/**
 * Phase R0 & R2 Connectivity and Integration Test for Cloudflare R2
 */
import { r2Provider } from '../src/integrations/r2/r2.provider.js';
import { env } from '../src/config/env.js';

async function main() {
  console.log('====================================================');
  console.log('  CLOUDFLARE R2 CONNECTIVITY & INTEGRATION TEST     ');
  console.log('====================================================');
  console.log(`Endpoint: ${env.R2_ENDPOINT ? 'Configured' : 'Missing'}`);
  console.log(`Public Bucket: ${env.R2_PUBLIC_BUCKET}`);
  console.log(`Private Bucket: ${env.R2_PRIVATE_BUCKET}`);
  console.log(`Public Base URL: ${env.R2_PUBLIC_BASE_URL}`);

  // 1. List Buckets
  console.log('\n--- 1. LISTING R2 BUCKETS ---');
  try {
    const buckets = await r2Provider.listBuckets();
    console.log(`Found ${buckets.length} bucket(s):`);
    buckets.forEach(b => console.log(`  - ${b.Name} (Created: ${b.CreationDate})`));

    const publicExists = buckets.some(b => b.Name === env.R2_PUBLIC_BUCKET);
    const privateExists = buckets.some(b => b.Name === env.R2_PRIVATE_BUCKET);

    // 2. Auto-create buckets if missing
    if (!publicExists) {
      console.log(`Bucket "${env.R2_PUBLIC_BUCKET}" does not exist. Creating...`);
      const createRes = await r2Provider.createBucketIfNotExists(env.R2_PUBLIC_BUCKET);
      console.log('Public bucket created:', createRes);
    } else {
      console.log(`✔ Public bucket "${env.R2_PUBLIC_BUCKET}" exists.`);
    }

    if (!privateExists) {
      console.log(`Bucket "${env.R2_PRIVATE_BUCKET}" does not exist. Creating...`);
      const createRes = await r2Provider.createBucketIfNotExists(env.R2_PRIVATE_BUCKET);
      console.log('Private bucket created:', createRes);
    } else {
      console.log(`✔ Private bucket "${env.R2_PRIVATE_BUCKET}" exists.`);
    }

    // 3. Test Object Put & Head in Public Bucket
    console.log('\n--- 2. TESTING PUBLIC BUCKET OBJECT PUT & VERIFY ---');
    const testKey = 'test/r2-connectivity-check.txt';
    const testContent = Buffer.from(`EDKL R2 Integration verified at ${new Date().toISOString()}`);

    const putRes = await r2Provider.putObject({
      bucket: env.R2_PUBLIC_BUCKET,
      key: testKey,
      body: testContent,
      contentType: 'text/plain; charset=utf-8'
    });
    console.log('Put result:', putRes);

    const headRes = await r2Provider.headObject({
      bucket: env.R2_PUBLIC_BUCKET,
      key: testKey
    });
    console.log('Head verification:', headRes);
    if (!headRes.exists || headRes.contentLength !== testContent.length) {
      throw new Error('Object verification mismatch!');
    }
    console.log('✔ Public object written and verified successfully!');

    // 4. Test Presigned Upload URL Generation
    console.log('\n--- 3. TESTING PRESIGNED UPLOAD URL GENERATION ---');
    const presigned = await r2Provider.generatePresignedUploadUrl({
      bucket: env.R2_PUBLIC_BUCKET,
      key: 'test/presigned-upload-sample.jpg',
      contentType: 'image/jpeg',
      expiresIn: 300
    });
    console.log('Presigned upload URL generated successfully (expiry: 300s)');
    console.log('Upload target key:', presigned.key);

    // 5. Test Private Bucket Put & Presigned Download
    console.log('\n--- 4. TESTING PRIVATE BUCKET PUT & PRESIGNED GET ---');
    const privateKey = 'test/private-audit.txt';
    await r2Provider.putObject({
      bucket: env.R2_PRIVATE_BUCKET,
      key: privateKey,
      body: Buffer.from('Sensitive Payment Proof Sandbox Test'),
      contentType: 'text/plain'
    });

    const privatePresigned = await r2Provider.generatePresignedDownloadUrl({
      bucket: env.R2_PRIVATE_BUCKET,
      key: privateKey,
      expiresIn: 180
    });
    console.log('Private presigned download URL generated successfully (expiry: 180s)');

    // 6. Clean up test objects
    console.log('\n--- 5. CLEANING UP TEST SANDBOX OBJECTS ---');
    await r2Provider.deleteObject({ bucket: env.R2_PUBLIC_BUCKET, key: testKey });
    await r2Provider.deleteObject({ bucket: env.R2_PRIVATE_BUCKET, key: privateKey });
    console.log('✔ Test objects deleted cleanly.');

    console.log('\n====================================================');
    console.log('  ALL R2 PHASE R0 & R2 INTEGRATION TESTS PASSED!    ');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ R2 Test Error:', err);
    process.exit(1);
  }
}

main();
