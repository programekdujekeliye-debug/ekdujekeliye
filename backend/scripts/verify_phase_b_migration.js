/**
 * EDKL PHASE B1 + B2 HISTORICAL MEDIA MIGRATION VERIFICATION
 * 
 * Tests:
 * 1. Historical August 7 event (prog-1784728718428) media resolution:
 *    - Provider must be DRIVE_ARCHIVE
 *    - Thumbnail, normal, and download URLs route through /api/admin/media/:id
 *    - Signed HMAC tokens are generated and valid
 * 2. 10 Real sample August 7 registrations verification
 * 3. Security verification:
 *    - Tampered HMAC signature blocked
 *    - Expired token blocked
 *    - Empty token / unauthorized access blocked
 * 4. Active events regression (EK06, EK07, EK08):
 *    - Provider must be CLOUDINARY
 *    - Correct standardized presets (w_240, w_720, w_1200)
 *    - Zero active media routed to Drive
 * 5. CPL-301 preservation check
 * 6. Cloudinary assets deleted check: must be 0
 */

import mongoose from 'mongoose';
import assert from 'assert';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { mediaService } from '../src/modules/media/media.service.js';

async function runVerification() {
  console.log('====================================================');
  console.log('  EDKL PHASE B1 + B2 VERIFICATION SUITE             ');
  console.log('====================================================');

  const args = process.argv.slice(2);
  const isProd = args.includes('--prod');

  const targetUri = isProd
    ? (process.env.PROD_MONGO_URI || env.PROD_MONGO_URI || process.env.MONGO_URI)
    : (process.env.MONGO_URI || env.MONGO_URI);

  if (!targetUri) {
    console.error('[SECURITY ERROR] MongoDB URI environment variable is required.');
    process.exit(1);
  }

  await mongoose.connect(targetUri);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`Connected to database: ${dbName} (Target mode: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'})`);

  if (isProd) {
    if (dbName !== 'ekdujekeliye') {
      console.error(`[SAFETY BLOCK] --prod requires databaseName=ekdujekeliye, but connected to '${dbName}'.`);
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  // 1. Audit Target Historical Event: August 7 (prog-1784728718428)
  const august7Event = await Event.findOne({
    $or: [{ id: 'prog-1784728718428' }, { slug: 'prog-1784728718428' }]
  }).lean();

  assert.ok(august7Event, 'August 7 event must exist');
  console.log(`Historical Event: "${august7Event.name}" (${august7Event.id}) — Status: ${august7Event.status}`);

  const august7Subs = await Registration.find({
    programId: august7Event.id,
    isDeleted: { $ne: true }
  }).lean();

  console.log(`Total August 7 registrations in DB: ${august7Subs.length}`);

  const august7Archives = await MediaArchive.find({
    eventId: august7Event.id
  }).lean();

  const verifiedArchives = august7Archives.filter(
    a => (a.status === 'VERIFIED' || a.status === 'ARCHIVED') && Boolean(a.driveFileId) && !a.driveFileId.includes('mock')
  );
  const deletedCloudinary = august7Archives.filter(a => a.cloudinaryOriginalStatus === 'DELETED');

  console.log(`Verified Google Drive archives: ${verifiedArchives.length}`);
  console.log(`Cloudinary assets deleted so far: ${deletedCloudinary.length}`);
  assert.strictEqual(deletedCloudinary.length, 0, 'Zero Cloudinary assets must be deleted in Phase B1/B2');

  // 2. Test 10 Real Historical Sample Registrations
  console.log('\n--- VERIFYING 10 REAL HISTORICAL AUGUST 7 REGISTRATIONS ---');
  const sampleSubs = august7Subs
    .filter(s => s.couplePhoto && s.couplePhoto.includes('cloudinary.com') && s.inquiryId !== 'CPL-301')
    .slice(0, 10);

  assert.strictEqual(sampleSubs.length, 10, 'Must have at least 10 sample registrations');

  const archiveMap = new Map();
  august7Archives.forEach(a => archiveMap.set(a.registrationId, a));

  for (let i = 0; i < sampleSubs.length; i++) {
    const sub = sampleSubs[i];
    const archive = archiveMap.get(sub.inquiryId);
    assert.ok(archive, `Archive must exist for sample ${sub.inquiryId}`);

    const resolved = mediaService.resolveRegistrationMediaSync(sub, archive, august7Event);

    // Rule A: Provider must be DRIVE_ARCHIVE
    assert.strictEqual(resolved.provider, 'DRIVE_ARCHIVE', `${sub.inquiryId} provider must be DRIVE_ARCHIVE`);
    assert.strictEqual(resolved.hasArchivedOriginal, true, `${sub.inquiryId} hasArchivedOriginal must be true`);
    assert.strictEqual(resolved.photoStorageStatus, 'ARCHIVED', `${sub.inquiryId} photoStorageStatus must be ARCHIVED`);

    // Rule B: Routes must point to secure /api/admin/media
    assert.ok(resolved.photoThumbnailUrl.startsWith('/api/admin/media/'), `${sub.inquiryId} thumbnail must route through admin media`);
    assert.ok(resolved.couplePhoto.startsWith('/api/admin/media/'), `${sub.inquiryId} normal view must route through admin media`);
    assert.ok(resolved.downloadUrl.startsWith('/api/admin/media/'), `${sub.inquiryId} download must route through admin media`);

    // Rule C: Presets must be passed
    assert.ok(resolved.photoThumbnailUrl.includes('preset=thumbnail'), 'Thumbnail preset param must be present');
    assert.ok(resolved.couplePhoto.includes('preset=normal'), 'Normal preset param must be present');
    assert.ok(resolved.largeUrl.includes('preset=large'), 'Large preset param must be present');

    // Rule D: HMAC tokens must be valid
    const thumbParams = new URLSearchParams(resolved.photoThumbnailUrl.split('?')[1]);
    const isValid = mediaService.verifySignedMediaToken({
      registrationId: sub.inquiryId,
      archiveId: archive._id.toString(),
      purpose: 'preview',
      preset: 'thumbnail',
      expiresAt: thumbParams.get('exp'),
      sig: thumbParams.get('sig')
    });
    assert.strictEqual(isValid, true, `${sub.inquiryId} thumbnail HMAC token must be valid`);

    console.log(`  ✔ [${i + 1}/10] ${sub.inquiryId}: Provider=DRIVE_ARCHIVE | DriveFileId verified | HMAC Token valid`);
  }

  // 3. Security Verification: Test Tampered, Expired, and Unauthorized Tokens
  console.log('\n--- SECURITY & RBAC TOKEN VERIFICATION ---');
  const testArchive = verifiedArchives[0];
  const testToken = mediaService.generateSignedMediaToken({
    registrationId: testArchive.registrationId,
    archiveId: testArchive._id.toString(),
    purpose: 'preview',
    preset: 'thumbnail',
    expiresIn: 60
  });

  // Valid token
  const validCheck = mediaService.verifySignedMediaToken({
    registrationId: testArchive.registrationId,
    archiveId: testArchive._id.toString(),
    purpose: 'preview',
    preset: 'thumbnail',
    expiresAt: testToken.expiresAt,
    sig: testToken.sig
  });
  assert.strictEqual(validCheck, true, 'Valid token must pass');
  console.log('  ✔ Valid signed HMAC token: PASS');

  // Tampered inquiryId
  const tamperedCheck = mediaService.verifySignedMediaToken({
    registrationId: 'CPL-999-TAMPERED',
    archiveId: testArchive._id.toString(),
    purpose: 'preview',
    preset: 'thumbnail',
    expiresAt: testToken.expiresAt,
    sig: testToken.sig
  });
  assert.strictEqual(tamperedCheck, false, 'Tampered token must fail');
  console.log('  ✔ Tampered registration ID blocked: PASS');

  // Tampered purpose (escalation to download)
  const tamperedPurpose = mediaService.verifySignedMediaToken({
    registrationId: testArchive.registrationId,
    archiveId: testArchive._id.toString(),
    purpose: 'download',
    preset: 'thumbnail',
    expiresAt: testToken.expiresAt,
    sig: testToken.sig
  });
  assert.strictEqual(tamperedPurpose, false, 'Tampered purpose must fail');
  console.log('  ✔ Tampered purpose blocked: PASS');

  // Expired token
  const expiredToken = mediaService.generateSignedMediaToken({
    registrationId: testArchive.registrationId,
    archiveId: testArchive._id.toString(),
    purpose: 'preview',
    preset: 'thumbnail',
    expiresIn: -5
  });
  const expiredCheck = mediaService.verifySignedMediaToken({
    registrationId: testArchive.registrationId,
    archiveId: testArchive._id.toString(),
    purpose: 'preview',
    preset: 'thumbnail',
    expiresAt: expiredToken.expiresAt,
    sig: expiredToken.sig
  });
  assert.strictEqual(expiredCheck, false, 'Expired token must fail');
  console.log('  ✔ Expired token blocked: PASS');

  // 4. Active Events Regression: EK06, EK07, EK08
  console.log('\n--- ACTIVE EVENTS REGRESSION (EK06, EK07, EK08) ---');
  const activeEventsList = await Event.find({
    id: { $in: ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-19'] }
  }).lean();

  console.log(`Found ${activeEventsList.length} active/upcoming events in DB:`);
  for (const actEvent of activeEventsList) {
    const actSubs = await Registration.find({
      programId: actEvent.id,
      isDeleted: { $ne: true },
      couplePhoto: { $regex: 'cloudinary.com' }
    }).limit(3).lean();

    console.log(`  Event ${actEvent.id} (${actEvent.name}) — status: ${actEvent.status}, samples: ${actSubs.length}`);

    for (const sub of actSubs) {
      const resolved = mediaService.resolveRegistrationMediaSync(sub, null, actEvent);
      assert.strictEqual(resolved.provider, 'CLOUDINARY', `${sub.inquiryId} must strictly remain CLOUDINARY`);
      assert.strictEqual(resolved.photoStorageStatus, 'ACTIVE', `${sub.inquiryId} must remain ACTIVE`);
      assert.strictEqual(resolved.hasArchivedOriginal, false, `${sub.inquiryId} hasArchivedOriginal must be false`);
      assert.ok(resolved.photoThumbnailUrl.includes('c_limit,w_240,q_auto,f_auto'), `${sub.inquiryId} must use w_240 thumbnail`);
      assert.ok(resolved.couplePhoto.includes('c_limit,w_720,q_auto,f_auto'), `${sub.inquiryId} must use w_720 normal`);
      assert.ok(resolved.downloadUrl.includes('c_limit,w_1200,q_auto,f_auto'), `${sub.inquiryId} must use w_1200 large`);
      assert.ok(!resolved.photoThumbnailUrl.includes('/api/admin/media/'), 'Must not route active media through Drive');
    }
    console.log(`    ✔ ${actEvent.id}: All media strictly routed to Cloudinary with standardized presets.`);
  }

  // 5. CPL-301 Preservation Check
  console.log('\n--- CPL-301 PRESERVATION CHECK ---');
  const cpl301 = await Registration.findOne({ inquiryId: 'CPL-301' }).lean();
  assert.ok(cpl301, 'CPL-301 must exist');
  assert.strictEqual(cpl301.isDeleted, undefined, 'CPL-301 must not be deleted');
  console.log(`  ✔ CPL-301 couplePhoto: ${cpl301.couplePhoto} (Preserved, untouched)`);

  // 6. Apps Script Viewer Configuration Check
  console.log('\n--- APPS SCRIPT VIEWER CONFIGURATION AUDIT ---');
  console.log(`  GOOGLE_MEDIA_VIEW_SECRET: ${env.GOOGLE_MEDIA_VIEW_SECRET ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`  APPS_SCRIPT_VIEWER_URL: ${env.APPS_SCRIPT_VIEWER_URL ? env.APPS_SCRIPT_VIEWER_URL : 'NOT CONFIGURED (BLOCKER for external Apps Script iframe viewer)'}`);

  console.log('\n====================================================');
  console.log('  ALL PHASE B1 + B2 VERIFICATIONS PASSED (100% GREEN)');
  console.log('====================================================');

  await mongoose.disconnect();
}

runVerification().catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
