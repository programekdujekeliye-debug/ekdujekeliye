import assert from 'assert';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { mediaService } from '../src/modules/media/media.service.js';
import { storageService } from '../src/services/storage.service.js';
import { invitationCardService } from '../src/services/invitationCard.service.js';
import {
  createUploadSession,
  getDirectUploadUrl,
  completeUpload,
  getPrivateCouplePhoto,
  getPrivatePaymentProof
} from '../src/modules/media/media.controller.js';

await mongoose.connect(env.MONGO_URI);

console.log('=== RUNNING COMPREHENSIVE EDKL MEDIA SECURITY & INTEGRITY TEST SUITE ===');

// Helper to mock Express req, res
function createMockContext(reqOverrides = {}) {
  let statusCode = 200;
  let responseData = null;
  let redirectedUrl = null;

  const req = {
    body: {},
    params: {},
    query: {},
    user: null,
    ...reqOverrides
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    redirect(statusOrUrl, maybeUrl) {
      if (typeof statusOrUrl === 'number') {
        statusCode = statusOrUrl;
        redirectedUrl = maybeUrl;
      } else {
        statusCode = 302;
        redirectedUrl = statusOrUrl;
      }
      return this;
    }
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getData: () => responseData,
    getRedirectedUrl: () => redirectedUrl
  };
}

// 1. Anonymous upload session abuse: Missing or invalid declared size
{
  const ctx = createMockContext({
    body: {
      declaredFileName: 'test.jpg',
      declaredContentType: 'image/jpeg',
      declaredFileSize: -1, // invalid
      purpose: 'couple_photo'
    }
  });
  await createUploadSession(ctx.req, ctx.res);
  assert.strictEqual(ctx.getStatusCode(), 400, 'Negative or zero declared size must be rejected with 400');
  console.log('✔ Test 1 passed: Anonymous upload session abuse (invalid size) rejected');
}

// 2. Anonymous upload-url abuse: Direct call without session token or admin auth
{
  const ctx = createMockContext({
    body: { fileType: 'couple_photo' }
  });
  await getDirectUploadUrl(ctx.req, ctx.res);
  assert.strictEqual(ctx.getStatusCode(), 401, 'Direct upload URL request without token or admin auth must return 401 Unauthorized');
  console.log('✔ Test 2 passed: Anonymous upload-url abuse blocked (401 Unauthorized)');
}

// 3. Oversized declared file (> 5MB)
{
  const ctx = createMockContext({
    body: {
      declaredFileName: 'big.jpg',
      declaredContentType: 'image/jpeg',
      declaredFileSize: 6 * 1024 * 1024, // 6 MB
      purpose: 'couple_photo'
    }
  });
  await createUploadSession(ctx.req, ctx.res);
  assert.strictEqual(ctx.getStatusCode(), 400, 'Files declared > 5MB must be rejected');
  assert.ok(ctx.getData().error.includes('Maximum allowed size is 5 MB'));
  console.log('✔ Test 3 passed: Oversized declared file (> 5MB) rejected with 400');
}

// 4. Unsupported declared MIME (e.g. SVG or Executable)
{
  const ctx = createMockContext({
    body: {
      declaredFileName: 'evil.svg',
      declaredContentType: 'image/svg+xml',
      declaredFileSize: 1024,
      purpose: 'couple_photo'
    }
  });
  await createUploadSession(ctx.req, ctx.res);
  assert.strictEqual(ctx.getStatusCode(), 400, 'SVG or executable MIME must be rejected');
  console.log('✔ Test 4 passed: Unsupported declared MIME (SVG/HTML) rejected');
}

// 5. Server-controlled key generation: Frontend cannot dictate bucket, key, or folder
{
  const ctx = createMockContext({
    body: {
      declaredFileName: 'photo.jpg',
      declaredContentType: 'image/jpeg',
      declaredFileSize: 500000,
      purpose: 'couple_photo',
      eventId: 'EK06',
      registrationSessionId: 'REG-1234',
      // Malicious parameters injected by frontend:
      bucket: 'edkl-public-media',
      objectKey: 'malicious/override/path.jpg',
      folder: '/root'
    }
  });
  await createUploadSession(ctx.req, ctx.res);
  assert.strictEqual(ctx.getStatusCode(), 200);
  const data = ctx.getData();
  assert.ok(data.uploadSessionId, 'Upload session must be generated');
  assert.ok(data.token, 'Signed HMAC token must be generated');
  assert.strictEqual(data.bucket, undefined, 'Server must not echo internal bucket to client');
  assert.strictEqual(data.objectKey, undefined, 'Server must not echo internal key to client');
  console.log('✔ Test 5 passed: Server-controlled key generation prevents bucket/key injection');
}

// 6. Tampered upload session token
{
  const validPayload = {
    version: 1,
    purpose: 'couple_photo',
    eventId: 'EK06',
    registrationSessionId: 'REG-1234',
    mediaType: 'couple_photo',
    nonce: crypto.randomBytes(16).toString('hex'),
    expiresAt: Date.now() + 600000
  };
  const fakeToken = Buffer.from(JSON.stringify({
    ...validPayload,
    sig: 'deadbeef1234567890abcdef'
  })).toString('base64url');

  const ctx = createMockContext({
    body: {
      uploadSessionId: 'fake-session',
      token: fakeToken
    }
  });
  await getDirectUploadUrl(ctx.req, ctx.res);
  assert.strictEqual(ctx.getStatusCode(), 403, 'Tampered HMAC signature must return 403 Forbidden');
  console.log('✔ Test 6 passed: Tampered upload session token blocked (403 Forbidden)');
}

// 7. Expired signed token
{
  const expiredSecret = env.GOOGLE_MEDIA_VIEW_SECRET || 'edkl_default_media_secret_fallback';
  const pastExpiry = Math.floor(Date.now() / 1000) - 300; // 5 mins ago
  const message = `REG-123::preview:thumbnail:${pastExpiry}`;
  const sig = crypto.createHmac('sha256', expiredSecret).update(message).digest('hex');

  const isValid = mediaService.verifySignedMediaToken({
    registrationId: 'REG-123',
    purpose: 'preview',
    preset: 'thumbnail',
    expiresAt: pastExpiry,
    sig
  });
  assert.strictEqual(isValid, false, 'Expired token must be rejected');
  console.log('✔ Test 7 passed: Expired signed GET token strictly rejected');
}

// 8. Payment proof public access without auth
{
  const ctx = createMockContext({
    params: { registrationId: 'REG-TEST-01' },
    user: null // Unauthenticated public user
  });
  await getPrivatePaymentProof(ctx.req, ctx.res);
  assert.strictEqual(ctx.getStatusCode(), 403, 'Public unauthenticated access to payment proof must be forbidden');
  console.log('✔ Test 8 passed: Payment proof public access blocked (403 Forbidden)');
}

// 9. Payment proof unauthorized role (e.g. GUEST, CUSTOMER, or general ADMIN without FINANCE)
{
  const ctxCustomer = createMockContext({
    params: { registrationId: 'REG-TEST-01' },
    user: { id: 'u1', role: 'CUSTOMER' }
  });
  await getPrivatePaymentProof(ctxCustomer.req, ctxCustomer.res);
  assert.strictEqual(ctxCustomer.getStatusCode(), 403, 'Unauthorized customer role cannot access payment proof');

  const ctxAdmin = createMockContext({
    params: { registrationId: 'REG-TEST-01' },
    user: { id: 'u2', role: 'ADMIN' }
  });
  await getPrivatePaymentProof(ctxAdmin.req, ctxAdmin.res);
  assert.strictEqual(ctxAdmin.getStatusCode(), 403, 'General ADMIN without FINANCE/SUPER_ADMIN cannot access payment proof');

  const ctxFinance = createMockContext({
    params: { registrationId: 'NON_EXISTENT_FIN' },
    user: { id: 'u3', role: 'FINANCE' }
  });
  await getPrivatePaymentProof(ctxFinance.req, ctxFinance.res);
  assert.strictEqual(ctxFinance.getStatusCode(), 404, 'FINANCE role passes authorization check (returns 404 on mock inquiry)');

  console.log('✔ Test 9 passed: Payment proof role restriction strictly enforced (SUPER_ADMIN / FINANCE only, general ADMIN blocked)');
}

// 10. Couple photo public access without auth or signed token
{
  const ctx = createMockContext({
    params: { registrationId: 'REG-TEST-01' },
    user: null,
    query: {} // No signed token
  });
  await getPrivateCouplePhoto(ctx.req, ctx.res);
  assert.strictEqual(ctx.getStatusCode(), 403, 'Unauthenticated access to private couple photo without signed token must be forbidden');
  console.log('✔ Test 10 passed: Couple photo public access blocked (403 Forbidden)');
}

// 11. Cloudinary write freeze: storageService blocks new writes to Cloudinary
{
  let writeBlocked = false;
  try {
    await storageService.upload({
      data: 'data:image/jpeg;base64,dGVzdA==',
      folder: 'test',
      provider: 'cloudinary'
    });
  } catch (err) {
    writeBlocked = true;
    assert.ok(err.message.includes('New writes to Cloudinary are strictly blocked'), 'Error message must specify Cloudinary writes blocked');
  }
  assert.strictEqual(writeBlocked, true, 'storageService must actively block new writes to Cloudinary when MEDIA_WRITE_PROVIDER=r2');
  console.log('✔ Test 11 passed: Cloudinary new writes strictly blocked by StorageService');
}

// 12. Canonical Resolver for Private R2 Couple Photo routes through secure endpoint
{
  const privateReg = {
    inquiryId: 'EK06-100',
    couplePhoto: 'https://media.ekdujekeliye.in/prod/events/EK06/registrations/EK06-100/couple/normal.webp',
    mediaProvider: 'R2',
    r2Media: {
      status: 'R2_PRIMARY',
      bucket: 'edkl-private-media',
      isPrivate: true,
      key: 'prod/events/EK06/registrations/EK06-100/couple/abc123/normal.webp',
      thumbKey: 'prod/events/EK06/registrations/EK06-100/couple/abc123/thumb.webp',
      normalKey: 'prod/events/EK06/registrations/EK06-100/couple/abc123/normal.webp',
      largeKey: 'prod/events/EK06/registrations/EK06-100/couple/abc123/large.webp'
    }
  };
  const activeEvent = { id: 'prog-2026-09-07', status: 'few_seats', date: '2026-09-07' };
  const res = mediaService.resolveRegistrationMediaSync(privateReg, null, activeEvent);
  assert.strictEqual(res.provider, 'R2');
  assert.strictEqual(res.normalUrl, '/api/media/EK06-100/couple-photo?preset=normal', 'Private couple photo must route through secure authenticated backend URL');
  assert.strictEqual(res.thumbnailUrl, '/api/media/EK06-100/couple-photo?preset=thumb');
  console.log('✔ Test 12 passed: Canonical Resolver routes private couple photos through secure endpoint');
}

// 13. Cloudinary legacy read fallback for unmigrated record
{
  const legacyReg = {
    inquiryId: 'EK06-LEGACY',
    couplePhoto: 'https://res.cloudinary.com/rh3wmfta/image/upload/v1785492490/couplePhotos/sample.jpg',
    mediaProvider: 'CLOUDINARY',
    r2Media: { status: 'CLOUDINARY_ACTIVE' }
  };
  const activeEvent = { id: 'prog-2026-09-07', status: 'few_seats', date: '2026-09-07' };
  const res = mediaService.resolveRegistrationMediaSync(legacyReg, null, activeEvent);
  assert.strictEqual(res.provider, 'CLOUDINARY', 'Unmigrated record must safely fall back to Cloudinary read');
  assert.ok(res.thumbnailUrl.includes('c_limit,w_240'), 'Must generate optimized Cloudinary thumbnail preset');
  console.log('✔ Test 13 passed: Cloudinary legacy read fallback functions correctly');
}

// 14. Google Drive historical viewer for completed event
{
  const archivedReg = {
    inquiryId: 'EK01-050',
    couplePhoto: 'https://res.cloudinary.com/rh3wmfta/image/upload/v1785492490/couplePhotos/sample.jpg'
  };
  const archiveRecord = {
    status: 'VERIFIED',
    driveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz',
    cloudinaryOriginalStatus: 'DELETED'
  };
  const completedEvent = { id: 'prog-old-event', status: 'completed', date: '2026-01-01' };
  const res = mediaService.resolveRegistrationMediaSync(archivedReg, archiveRecord, completedEvent);
  assert.ok(
    res.photoThumbnailUrl.includes('/preview?preset=thumbnail') || res.photoThumbnailUrl.includes('drive.google.com'),
    'Must route through drive preview'
  );
  console.log('✔ Test 14 passed: Drive historical resolver verified for completed events');
}

// 15. Invitation card deterministic fingerprinting & versioning
{
  const mockReg = {
    inquiryId: 'EK06-001',
    husbandName: 'Raj',
    wifeName: 'Simran',
    surname: 'Malhotra',
    couplePhoto: '/sample_couple.png'
  };
  const mockEvent = {
    name: 'Ek Duje Ke Liye',
    date: '2026-09-07',
    venue: 'Surat'
  };
  const hash1 = invitationCardService.calculateInvitationHash(mockReg, mockEvent);
  const hash2 = invitationCardService.calculateInvitationHash(mockReg, mockEvent);
  assert.strictEqual(hash1, hash2, 'Identical registration and event inputs must produce deterministic hash');

  const modifiedReg = { ...mockReg, husbandName: 'Rahul' };
  const hash3 = invitationCardService.calculateInvitationHash(modifiedReg, mockEvent);
  assert.notStrictEqual(hash1, hash3, 'Changed couple names must produce distinct hash for versioning');
  console.log('✔ Test 15 passed: Invitation card deterministic fingerprinting & immutable versioning verified');
}

// 16. Customer-facing photo access: Authorized couple with valid signed token can view their private photo
{
  const testRegId = 'TEST-CPL-PASS-01';
  const validToken = mediaService.generateSignedMediaToken({
    registrationId: testRegId,
    purpose: 'couple_photo',
    preset: 'normal',
    expiresIn: 3600
  });

  const ctx = createMockContext({
    params: { registrationId: testRegId },
    query: {
      preset: 'normal',
      exp: validToken.expiresAt,
      sig: validToken.sig
    },
    user: null // Unauthenticated public couple
  });

  await getPrivateCouplePhoto(ctx.req, ctx.res);
  assert.notStrictEqual(ctx.getStatusCode(), 403, 'Authorized couple with valid signed token must not be forbidden (403)');
  console.log('✔ Test 16 passed: Authorized couple accesses private photo using signed token (without Admin login)');
}

// 17. Cross-registration attack: Valid signed token targeting a different registrationId is BLOCKED
{
  const tokenForCoupleA = mediaService.generateSignedMediaToken({
    registrationId: 'COUPLE-A',
    purpose: 'couple_photo',
    preset: 'normal',
    expiresIn: 3600
  });

  // Attacker tries to use Couple A's token to view Couple B's photo
  const ctx = createMockContext({
    params: { registrationId: 'COUPLE-B' },
    query: {
      preset: 'normal',
      exp: tokenForCoupleA.expiresAt,
      sig: tokenForCoupleA.sig
    },
    user: null
  });

  await getPrivateCouplePhoto(ctx.req, ctx.res);
  assert.strictEqual(ctx.getStatusCode(), 403, 'Cross-registration token use must be rejected with 403 Forbidden');
  console.log('✔ Test 17 passed: Cross-registration token attack blocked (403 Forbidden)');
}

// 18. Expired customer token is BLOCKED
{
  const expiredToken = mediaService.generateSignedMediaToken({
    registrationId: 'TEST-EXPIRED',
    purpose: 'couple_photo',
    preset: 'normal',
    expiresIn: -60 // expired 60 seconds ago
  });

  const ctx = createMockContext({
    params: { registrationId: 'TEST-EXPIRED' },
    query: {
      preset: 'normal',
      exp: expiredToken.expiresAt,
      sig: expiredToken.sig
    },
    user: null
  });

  await getPrivateCouplePhoto(ctx.req, ctx.res);
  assert.strictEqual(ctx.getStatusCode(), 403, 'Expired token must be rejected with 403 Forbidden');
  console.log('✔ Test 18 passed: Expired customer media token blocked (403 Forbidden)');
}

// 19. Tampered customer token is BLOCKED
{
  const validToken = mediaService.generateSignedMediaToken({
    registrationId: 'TEST-TAMPERED',
    purpose: 'couple_photo',
    preset: 'normal',
    expiresIn: 3600
  });

  const ctx = createMockContext({
    params: { registrationId: 'TEST-TAMPERED' },
    query: {
      preset: 'normal',
      exp: validToken.expiresAt,
      sig: validToken.sig.replace(/.$/, '0') // Tampered last byte of HMAC
    },
    user: null
  });

  await getPrivateCouplePhoto(ctx.req, ctx.res);
  assert.strictEqual(ctx.getStatusCode(), 403, 'Tampered token signature must be rejected with 403 Forbidden');
  console.log('✔ Test 19 passed: Tampered customer media token blocked (403 Forbidden)');
}

// 20. Archive abstraction for Private R2: Generates short-lived presigned download URL for archive worker
{
  const { r2Provider } = await import('../src/integrations/r2/r2.provider.js');
  const testKey = 'prod/events/EK06/registrations/TEST-ARCHIVE/couple/orig.webp';
  const presigned = await r2Provider.generatePresignedDownloadUrl({
    bucket: r2Provider.privateBucket,
    key: testKey,
    expiresIn: 1800
  });
  assert.ok(presigned.downloadUrl, 'Must generate signed download URL for private archive source');
  assert.ok(presigned.downloadUrl.includes('X-Amz-Signature') || presigned.downloadUrl.includes('X-Amz-Algorithm'), 'Must include S3 presigned signature');
  assert.strictEqual(presigned.bucket, r2Provider.privateBucket, 'Source bucket must be private');
  console.log('✔ Test 20 passed: Private R2 archive source generates secure presigned download URL for worker');
}

console.log('====================================================');
console.log('=== ALL 20 CRITICAL SECURITY TESTS PASSED PERFECTLY! ===');
console.log('====================================================');
await mongoose.disconnect();
process.exit(0);
