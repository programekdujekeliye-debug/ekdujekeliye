import assert from 'assert';
import { getOptimizedPhotoUrl, MEDIA_PRESETS } from '../src/utils/mediaPresets.js';

console.log('=== RUNNING MEDIA PRESET UNIT TESTS ===');

// 1. Raw Cloudinary URL with version
{
  const raw = 'https://res.cloudinary.com/rh3wmfta/image/upload/v1785492490/couplePhotos/ywcfftpcirnovto2qe6c.jpg';
  const thumb = getOptimizedPhotoUrl(raw, 'thumbnail');
  assert.strictEqual(
    thumb,
    'https://res.cloudinary.com/rh3wmfta/image/upload/c_limit,w_240,q_auto,f_auto/v1785492490/couplePhotos/ywcfftpcirnovto2qe6c.jpg',
    'Raw URL should get thumbnail preset'
  );
  console.log('✔ Test 1 passed: Raw Cloudinary URL with version');
}

// 2. Raw Cloudinary URL without version
{
  const raw = 'https://res.cloudinary.com/rh3wmfta/image/upload/couplePhotos/abc1234.jpg';
  const normal = getOptimizedPhotoUrl(raw, 'normal');
  assert.strictEqual(
    normal,
    'https://res.cloudinary.com/rh3wmfta/image/upload/c_limit,w_720,q_auto,f_auto/couplePhotos/abc1234.jpg',
    'Raw URL without version should get normal preset'
  );
  console.log('✔ Test 2 passed: Raw Cloudinary URL without version');
}

// 3. Already transformed URL (single segment)
{
  const transformed = 'https://res.cloudinary.com/rh3wmfta/image/upload/w_360,h_480,c_limit,q_auto,f_auto/v1785492490/couplePhotos/ywcfftpcirnovto2qe6c.jpg';
  const thumb = getOptimizedPhotoUrl(transformed, 'thumbnail');
  assert.strictEqual(
    thumb,
    'https://res.cloudinary.com/rh3wmfta/image/upload/c_limit,w_240,q_auto,f_auto/v1785492490/couplePhotos/ywcfftpcirnovto2qe6c.jpg',
    'Already transformed URL should have its transformation cleanly replaced without chaining'
  );
  console.log('✔ Test 3 passed: Already transformed single-segment URL replaced cleanly');
}

// 4. Already transformed URL (custom legacy w_400)
{
  const transformed = 'https://res.cloudinary.com/rh3wmfta/image/upload/c_limit,w_400,q_auto,f_auto/v1785492490/couplePhotos/ywcfftpcirnovto2qe6c.jpg';
  const large = getOptimizedPhotoUrl(transformed, 'large');
  assert.strictEqual(
    large,
    'https://res.cloudinary.com/rh3wmfta/image/upload/c_limit,w_1200,q_auto,f_auto/v1785492490/couplePhotos/ywcfftpcirnovto2qe6c.jpg',
    'w_400 should be replaced with large preset w_1200'
  );
  console.log('✔ Test 4 passed: Legacy w_400 cleanly replaced with large preset');
}

// 5. Multiple chained transformation segments
{
  const chained = 'https://res.cloudinary.com/rh3wmfta/image/upload/c_limit,w_300/q_auto,f_auto/v1785492490/couplePhotos/ywcfftpcirnovto2qe6c.jpg';
  const thumb = getOptimizedPhotoUrl(chained, 'thumbnail');
  assert.strictEqual(
    thumb,
    'https://res.cloudinary.com/rh3wmfta/image/upload/c_limit,w_240,q_auto,f_auto/v1785492490/couplePhotos/ywcfftpcirnovto2qe6c.jpg',
    'Multiple chained transformation segments should all be stripped and replaced with single preset'
  );
  console.log('✔ Test 5 passed: Multiple chained segments stripped cleanly');
}

// 6. Non-Cloudinary Google Drive URL
{
  const driveUrl = 'https://drive.google.com/uc?id=1AbCdEfGhIjKlMnOpQrStUvWxYz';
  assert.strictEqual(getOptimizedPhotoUrl(driveUrl, 'thumbnail'), driveUrl, 'Drive URL must be untouched');
  console.log('✔ Test 6 passed: Google Drive URL untouched');
}

// 7. Google Apps Script viewer URL
{
  const gasUrl = 'https://script.google.com/macros/s/AKfycbx.../exec?id=1AbCdEfGh';
  assert.strictEqual(getOptimizedPhotoUrl(gasUrl, 'normal'), gasUrl, 'Apps Script viewer URL must be untouched');
  console.log('✔ Test 7 passed: Apps Script viewer URL untouched');
}

// 8. Local relative static URL
{
  const localUrl = '/sample_couple.png';
  assert.strictEqual(getOptimizedPhotoUrl(localUrl, 'thumbnail'), localUrl, 'Local static URL must be untouched');
  console.log('✔ Test 8 passed: Local static URL untouched');
}

// 9. Data URI
{
  const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';
  assert.strictEqual(getOptimizedPhotoUrl(dataUri, 'large'), dataUri, 'Data URI must be untouched');
  console.log('✔ Test 9 passed: Data URI untouched');
}

// 10. Null / undefined / empty string
{
  assert.strictEqual(getOptimizedPhotoUrl(null), '', 'null returns empty string');
  assert.strictEqual(getOptimizedPhotoUrl(undefined), '', 'undefined returns empty string');
  assert.strictEqual(getOptimizedPhotoUrl(''), '', 'empty string returns empty string');
  assert.strictEqual(getOptimizedPhotoUrl('   '), '', 'whitespace returns empty string');
  console.log('✔ Test 10 passed: Null/empty/whitespace returns empty string');
}

// 11. Relative /api/admin/media URL
{
  const adminMediaUrl = '/api/admin/media/CPL-101/preview?preset=thumbnail&exp=1788700000&sig=abcdef123456';
  assert.strictEqual(getOptimizedPhotoUrl(adminMediaUrl, 'thumbnail'), adminMediaUrl, 'Admin media route must be untouched');
  console.log('✔ Test 11 passed: Admin media route untouched');
}

import { mediaService } from '../src/modules/media/media.service.js';

// 12. Canonical Resolver — Active Event (EK06) must remain Cloudinary
{
  const activeReg = {
    inquiryId: 'EK06-101',
    couplePhoto: 'https://res.cloudinary.com/rh3wmfta/image/upload/v1785492490/couplePhotos/sample123.jpg'
  };
  const activeEvent = { status: 'few_seats', date: '2026-09-07' };
  const res = mediaService.resolveRegistrationMediaSync(activeReg, null, activeEvent);
  assert.strictEqual(res.provider, 'CLOUDINARY', 'Active event provider must be CLOUDINARY');
  assert.strictEqual(res.photoStorageStatus, 'ACTIVE', 'Active event storage must be ACTIVE');
  assert.ok(res.thumbnailUrl.includes('c_limit,w_240,q_auto,f_auto'), 'Must use thumbnail preset w_240');
  assert.ok(res.normalUrl.includes('c_limit,w_720,q_auto,f_auto'), 'Must use normal preset w_720');
  assert.ok(res.largeUrl.includes('c_limit,w_1200,q_auto,f_auto'), 'Must use large preset w_1200');
  assert.strictEqual(res.hasArchivedOriginal, false, 'hasArchivedOriginal must be false for active event');
  console.log('✔ Test 12 passed: Canonical Resolver for Active Event (EK06) strictly uses Cloudinary');
}

// 13. Canonical Resolver — Completed Event with verified Drive copy
{
  const completedReg = {
    inquiryId: 'CPL-597',
    couplePhoto: 'https://res.cloudinary.com/rh3wmfta/image/upload/v1785492490/couplePhotos/ywcfftpcirnovto2qe6c.jpg'
  };
  const completedEvent = { status: 'completed', date: '2026-08-07' };
  const verifiedArchive = {
    _id: '6a90bb161ca7a2fb4ec9463f',
    status: 'VERIFIED',
    driveFileId: '1fyJCJjrsno3gCv0M1jfTa4j11i4RVlne',
    cloudinaryOriginalStatus: 'ACTIVE'
  };
  const res = mediaService.resolveRegistrationMediaSync(completedReg, verifiedArchive, completedEvent);
  assert.strictEqual(res.provider, 'DRIVE_ARCHIVE', 'Completed event with verified archive must be DRIVE_ARCHIVE');
  assert.strictEqual(res.photoStorageStatus, 'ARCHIVED', 'Storage status must be ARCHIVED');
  assert.strictEqual(res.hasArchivedOriginal, true, 'hasArchivedOriginal must be true');
  assert.ok(res.photoThumbnailUrl.startsWith('/api/admin/media/CPL-597/preview?preset=thumbnail'), 'Thumbnail must route through admin media preview');
  assert.ok(res.couplePhoto.startsWith('/api/admin/media/CPL-597/preview?preset=normal'), 'Normal preview must route through admin media preview');
  assert.ok(res.downloadUrl.startsWith('/api/admin/media/CPL-597/download'), 'Download must route through admin media download');
  console.log('✔ Test 13 passed: Canonical Resolver for Completed Event with verified archive uses Drive');
}

// 14. Canonical Resolver — Deleted Cloudinary original without Drive archive fallback
{
  const deletedReg = {
    inquiryId: 'CPL-999',
    couplePhoto: 'https://res.cloudinary.com/rh3wmfta/image/upload/v1785492490/couplePhotos/deleted.jpg'
  };
  const completedEvent = { status: 'completed', date: '2026-08-07' };
  const deletedArchive = {
    status: 'FAILED',
    driveFileId: null,
    cloudinaryOriginalStatus: 'DELETED'
  };
  const res = mediaService.resolveRegistrationMediaSync(deletedReg, deletedArchive, completedEvent);
  assert.strictEqual(res.provider, 'FALLBACK', 'Deleted asset without archive must use FALLBACK');
  assert.strictEqual(res.photoThumbnailUrl, '/sample_couple.png', 'Must return safe placeholder');
  assert.strictEqual(res.canDownloadOriginal, false, 'Cannot download original');
  console.log('✔ Test 14 passed: Deleted original without archive safely falls back to placeholder');
}

// 15. Signed Token Security Verification (valid, expired, tampered)
{
  const regId = 'CPL-597';
  const archiveId = '6a90bb161ca7a2fb4ec9463f';
  const token = mediaService.generateSignedMediaToken({ registrationId: regId, archiveId, purpose: 'preview', preset: 'thumbnail', expiresIn: 60 });
  
  // A. Valid token
  const isValid = mediaService.verifySignedMediaToken({
    registrationId: regId,
    archiveId,
    purpose: 'preview',
    preset: 'thumbnail',
    expiresAt: token.expiresAt,
    sig: token.sig
  });
  assert.strictEqual(isValid, true, 'Valid token must verify');

  // B. Tampered registrationId
  const isTampered = mediaService.verifySignedMediaToken({
    registrationId: 'CPL-999',
    archiveId,
    purpose: 'preview',
    preset: 'thumbnail',
    expiresAt: token.expiresAt,
    sig: token.sig
  });
  assert.strictEqual(isTampered, false, 'Tampered registration ID must fail');

  // C. Expired token
  const expiredToken = mediaService.generateSignedMediaToken({ registrationId: regId, archiveId, purpose: 'preview', preset: 'thumbnail', expiresIn: -10 });
  const isExpired = mediaService.verifySignedMediaToken({
    registrationId: regId,
    archiveId,
    purpose: 'preview',
    preset: 'thumbnail',
    expiresAt: expiredToken.expiresAt,
    sig: expiredToken.sig
  });
  assert.strictEqual(isExpired, false, 'Expired token must fail');

  console.log('✔ Test 15 passed: Signed HMAC media token passes security tests (tamper-proof, expiry-enforced)');
}

console.log('=== ALL MEDIA PRESET & RESOLVER UNIT TESTS PASSED SUCCESSFULLY! ===');
process.exit(0);
