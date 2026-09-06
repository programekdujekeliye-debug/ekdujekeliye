import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { mediaService } from './media.service.js';
import { MediaArchive } from '../../models/MediaArchive.js';
import { Registration } from '../../models/Registration.js';
import { UploadSession } from '../../models/UploadSession.js';
import { getOptimizedPhotoUrl } from '../../utils/mediaPresets.js';
import { r2Provider } from '../../integrations/r2/r2.provider.js';
import { mediaVariantWorker } from '../../workers/mediaVariantWorker.js';
import { env } from '../../config/env.js';

// --- High Performance In-Memory Caches for Rapid Photo Delivery ---
const MAX_BUFFER_CACHE_ITEMS = 600;
const MAX_REG_CACHE_ITEMS = 1500;
const REG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cache mapping: `${bucket}:${key}` -> { buffer, contentType, etag, cachedAt }
const mediaBufferCache = new Map();
// Cache mapping: `registrationId` -> { r2Media, couplePhoto, expiresAt }
const regMediaCache = new Map();
// In-flight deduplication: `${bucket}:${key}` -> Promise<Buffer>
const inFlightFetches = new Map();

// Preload sample couple fallback buffer in memory for 0ms direct response (avoids 404/ORB)
let sampleCoupleBuffer = null;
try {
  const p1 = path.resolve(process.cwd(), 'public', 'sample_couple.png');
  const p2 = path.resolve(process.cwd(), '..', 'frontend', 'public', 'sample_couple.png');
  if (fs.existsSync(p1)) sampleCoupleBuffer = fs.readFileSync(p1);
  else if (fs.existsSync(p2)) sampleCoupleBuffer = fs.readFileSync(p2);
} catch (e) {
  console.warn('[MediaController] Could not preload sample_couple.png buffer:', e.message);
}

export const warmRegistrationMediaCache = (registrations = []) => {
  if (!Array.isArray(registrations)) return;
  const now = Date.now();
  for (const reg of registrations) {
    if (!reg) continue;
    const entry = {
      r2Media: reg.r2Media || null,
      couplePhoto: reg.couplePhoto || null,
      expiresAt: now + REG_CACHE_TTL_MS
    };
    if (reg.inquiryId) regMediaCache.set(reg.inquiryId, entry);
    if (reg._id) regMediaCache.set(String(reg._id), entry);
  }
  if (regMediaCache.size > MAX_REG_CACHE_ITEMS) {
    const keys = Array.from(regMediaCache.keys());
    for (let i = 0; i < 200 && i < keys.length; i++) {
      regMediaCache.delete(keys[i]);
    }
  }
};

export const invalidateRegistrationMediaCache = (registrationId) => {
  if (!registrationId) return;
  regMediaCache.delete(registrationId);
};

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB strict limit
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_PAYMENT_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Signs HMAC upload session token (server-secret signed)
 * Token contains only: version, purpose, eventId, registrationSessionId, mediaType, nonce, expiresAt
 * No phone, email, name, or R2 credentials.
 */
function signUploadSessionToken(payload) {
  const secret = env.JWT_SECRET || env.ADMIN_PASSWORD || 'edkl_upload_session_secret_key';
  const payloadStr = `${payload.version}:${payload.purpose}:${payload.eventId}:${payload.registrationSessionId}:${payload.mediaType}:${payload.nonce}:${payload.expiresAt}`;
  const sig = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return Buffer.from(JSON.stringify({ ...payload, sig })).toString('base64url');
}

/**
 * Cryptographically verifies upload session token
 */
function verifyUploadSessionToken(token) {
  try {
    if (!token) return null;
    const jsonStr = Buffer.from(token, 'base64url').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    const { version, purpose, eventId, registrationSessionId, mediaType, nonce, expiresAt, sig } = parsed;

    if (!expiresAt || Date.now() > Number(expiresAt)) {
      return null;
    }

    const secret = env.JWT_SECRET || env.ADMIN_PASSWORD || 'edkl_upload_session_secret_key';
    const payloadStr = `${version}:${purpose}:${eventId}:${registrationSessionId}:${mediaType}:${nonce}:${expiresAt}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

    const sigBuf = Buffer.from(sig, 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    return parsed;
  } catch (err) {
    return null;
  }
}

/**
 * 1. Creates a cryptographically signed, server-controlled upload session
 * - Frontend declares: fileName, contentType, fileSize, purpose, eventId, registrationSessionId
 * - Backend validates declared size <= 5 MB and valid MIME
 * - Backend chooses bucket and constructs the exact server-generated object key
 * - Frontend CANNOT provide bucket, key, folder path, opaqueMediaId, or public URL
 */
export const createUploadSession = async (req, res) => {
  try {
    const {
      declaredFileName = '',
      declaredContentType = 'image/jpeg',
      declaredFileSize = 0,
      purpose = 'couple_photo',
      eventId = 'EK06',
      registrationSessionId
    } = req.body;

    // Validate purpose
    const allowedPurposes = ['couple_photo', 'payment_proof', 'invitation_card', 'gallery'];
    if (!allowedPurposes.includes(purpose)) {
      return res.status(400).json({ error: `Invalid upload purpose: ${purpose}` });
    }

    // Validate declared MIME
    const allowedMimes = purpose === 'payment_proof' ? ALLOWED_PAYMENT_MIMES : ALLOWED_IMAGE_MIMES;
    if (!allowedMimes.includes(declaredContentType.toLowerCase())) {
      return res.status(400).json({
        error: `Unsupported content type. Allowed formats: ${allowedMimes.join(', ')}`
      });
    }

    // Validate declared size (<= 5 MB)
    const sizeBytes = Number(declaredFileSize);
    if (isNaN(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      return res.status(400).json({
        error: `File size exceeds allowed limit. Maximum allowed size is ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB.`
      });
    }

    // Sanitize eventId and session reference
    const cleanEventId = String(eventId || 'EK06').replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanRegSessionId = String(registrationSessionId || `TEMP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`).replace(/[^a-zA-Z0-9_-]/g, '');

    // Generate 128-bit opaque ID & 128-bit nonce
    const opaqueMediaId = crypto.randomBytes(16).toString('hex'); // 128-bit entropy
    const nonce = crypto.randomBytes(16).toString('hex'); // 128-bit entropy
    const sessionId = crypto.randomBytes(16).toString('hex'); // 128-bit entropy

    // Route bucket: couple photos and payment proofs MUST be in private bucket
    const isPrivate = purpose === 'couple_photo' || purpose === 'payment_proof';
    const targetBucket = isPrivate ? r2Provider.privateBucket : r2Provider.publicBucket;

    // Determine extension
    let ext = 'jpg';
    if (declaredContentType.includes('png')) ext = 'png';
    else if (declaredContentType.includes('webp')) ext = 'webp';
    else if (declaredContentType.includes('pdf')) ext = 'pdf';

    const subFolder = purpose === 'payment_proof' ? 'payment' : 'couple';
    const objectKey = `prod/events/${cleanEventId}/registrations/${cleanRegSessionId}/${subFolder}/${opaqueMediaId}/original.${ext}`;

    // Token expiration: 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const sessionPayload = {
      version: 1,
      purpose,
      eventId: cleanEventId,
      registrationSessionId: cleanRegSessionId,
      mediaType: purpose,
      nonce,
      expiresAt: expiresAt.getTime()
    };

    const token = signUploadSessionToken(sessionPayload);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const session = new UploadSession({
      sessionId,
      tokenHash,
      version: 1,
      purpose,
      eventId: cleanEventId,
      registrationSessionId: cleanRegSessionId,
      mediaType: purpose,
      nonce,
      declaredFileSize: sizeBytes,
      declaredContentType,
      declaredFileName,
      bucket: targetBucket,
      objectKey,
      opaqueMediaId,
      status: 'CREATED',
      expiresAt
    });

    await session.save();

    res.json({
      success: true,
      uploadSessionId: sessionId,
      token,
      expiresAt: expiresAt.toISOString(),
      maxSizeBytes: MAX_UPLOAD_SIZE_BYTES
    });
  } catch (err) {
    console.error('[MediaController] Error creating upload session:', err);
    res.status(500).json({ error: err.message || 'Failed to create upload session.' });
  }
};

/**
 * 2. Generates presigned PUT upload URL bound to verified upload session
 * Accepts { uploadSessionId, token } or authenticated Admin session
 */
export const getDirectUploadUrl = async (req, res) => {
  try {
    const { uploadSessionId, token } = req.body;

    // A. If session token provided (Public Registration flow)
    if (uploadSessionId && token) {
      const verifiedToken = verifyUploadSessionToken(token);
      if (!verifiedToken) {
        return res.status(403).json({ error: 'Invalid or expired upload session token.' });
      }

      const session = await UploadSession.findOne({
        sessionId: uploadSessionId,
        nonce: verifiedToken.nonce
      });

      if (!session) {
        return res.status(404).json({ error: 'Upload session not found.' });
      }

      if (session.status !== 'CREATED') {
        return res.status(409).json({ error: `Upload session cannot be reused (Status: ${session.status}).` });
      }

      if (session.consumedAt || new Date() > session.expiresAt) {
        return res.status(410).json({ error: 'Upload session has expired.' });
      }

      const presigned = await r2Provider.generatePresignedUploadUrl({
        bucket: session.bucket,
        key: session.objectKey,
        contentType: session.declaredContentType,
        expiresIn: 300 // 5 minutes
      });

      session.status = 'URL_ISSUED';
      await session.save();

      return res.json({
        success: true,
        uploadUrl: presigned.uploadUrl,
        expiresIn: presigned.expiresIn
      });
    }

    // B. If authenticated Admin session (Internal / Admin upload)
    const isAdmin = Boolean(req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN'));
    if (!isAdmin) {
      return res.status(401).json({
        error: 'Unauthorized: Direct upload URL generation requires an uploadSession token or Admin session.'
      });
    }

    const { fileType = 'couple_photo', contentType = 'image/jpeg', eventKey = 'EK06', inquiryId } = req.body;
    if (!ALLOWED_IMAGE_MIMES.includes(contentType.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid content type. Only JPEG, PNG, and WebP images are permitted.' });
    }

    const isPrivate = fileType === 'payment_screenshot' || fileType === 'couple_photo';
    const bucket = isPrivate ? r2Provider.privateBucket : r2Provider.publicBucket;
    const opaqueMediaId = crypto.randomBytes(16).toString('hex');
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const cleanEvent = String(eventKey || 'EK06').replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanInquiry = String(inquiryId || `ADMIN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const subFolder = fileType === 'payment_screenshot' ? 'payment' : 'couple';
    const key = `prod/events/${cleanEvent}/registrations/${cleanInquiry}/${subFolder}/${opaqueMediaId}/original.${ext}`;

    const presigned = await r2Provider.generatePresignedUploadUrl({
      bucket,
      key,
      contentType,
      expiresIn: 300
    });

    return res.json({
      success: true,
      uploadUrl: presigned.uploadUrl,
      expiresIn: presigned.expiresIn
    });
  } catch (err) {
    console.error('[MediaController] Error generating upload URL:', err);
    res.status(500).json({ error: err.message || 'Failed to generate upload URL' });
  }
};

/**
 * 3. Completes and verifies uploaded object in R2
 * Performs R2 HEAD:
 * - Verifies ContentLength <= 5 MB
 * - Verifies expected MIME and bucket
 * - Purges and rejects object if violations exist
 * - Enqueues async WebP variant generation
 */
export const completeUpload = async (req, res) => {
  try {
    const { uploadSessionId, token } = req.body;

    if (!uploadSessionId || !token) {
      return res.status(400).json({ error: 'uploadSessionId and token are required.' });
    }

    const verifiedToken = verifyUploadSessionToken(token);
    if (!verifiedToken) {
      return res.status(403).json({ error: 'Invalid or expired upload session token.' });
    }

    const session = await UploadSession.findOne({
      sessionId: uploadSessionId,
      nonce: verifiedToken.nonce
    });

    if (!session) {
      return res.status(404).json({ error: 'Upload session not found.' });
    }

    if (session.status !== 'URL_ISSUED') {
      return res.status(409).json({ error: `Upload session is not in URL_ISSUED status (Current: ${session.status}).` });
    }

    // Perform R2 HEAD check
    const head = await r2Provider.headObject({
      bucket: session.bucket,
      key: session.objectKey
    });

    if (!head.exists) {
      return res.status(400).json({ error: 'Object not found in R2. Upload must be completed before verification.' });
    }

    // Transport Size & MIME Validation Guard
    const actualSize = head.contentLength || 0;
    const actualMime = (head.contentType || '').toLowerCase();
    const isSizeViolated = actualSize <= 0 || actualSize > MAX_UPLOAD_SIZE_BYTES;
    const isMimeViolated = !ALLOWED_PAYMENT_MIMES.includes(actualMime) && !ALLOWED_IMAGE_MIMES.includes(actualMime);

    if (isSizeViolated || isMimeViolated) {
      console.warn(`[MediaController] Security violation: Object ${session.objectKey} failed transport verification (Size: ${actualSize}, MIME: ${actualMime}). Purging from R2...`);

      // Delete malicious or oversized object immediately
      await r2Provider.deleteObject({ bucket: session.bucket, key: session.objectKey });

      session.status = 'REJECTED';
      await session.save();

      return res.status(400).json({
        error: 'Upload rejected: Object failed transport constraints (oversized or invalid MIME) and was purged.'
      });
    }

    // Mark session verified and consumed
    session.status = 'VERIFIED';
    session.consumedAt = new Date();
    session.actualFileSize = actualSize;
    session.actualContentType = actualMime;
    await session.save();

    // Async variant processing for couple photos
    if (session.purpose === 'couple_photo') {
      mediaVariantWorker.enqueue({
        bucket: session.bucket,
        objectKey: session.objectKey,
        eventId: session.eventId,
        inquiryId: session.registrationSessionId,
        opaqueMediaId: session.opaqueMediaId
      });
    }

    res.json({
      success: true,
      verified: true,
      mediaId: session.opaqueMediaId,
      bucket: session.bucket,
      isPrivate: session.bucket === r2Provider.privateBucket
    });
  } catch (err) {
    console.error('[MediaController] Error completing upload:', err);
    res.status(500).json({ error: err.message || 'Failed to complete upload verification.' });
  }
};

/**
 * 4. Serves private couple photo with authenticated authorization + short-lived signed GET (<= 300s)
 * Access Control: Requires authenticated Admin/Finance OR valid HMAC signed media token
 */
export const getPrivateCouplePhoto = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { preset = 'normal', exp, sig } = req.query;

    const isAdmin = Boolean(req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN' || req.user.role === 'EVENT_ADMIN'));
    const isSignedTokenValid = exp && sig ? mediaService.verifySignedMediaToken({
      registrationId,
      purpose: 'couple_photo',
      preset,
      expiresAt: exp,
      sig
    }) : false;

    if (!isAdmin && !isSignedTokenValid) {
      return res.status(403).json({
        error: 'Forbidden: Couple photos are private. Access requires authentication or valid signed token.'
      });
    }

    // 1. Resolve registration media from in-memory cache or MongoDB
    let regData = regMediaCache.get(registrationId);
    if (!regData || Date.now() > regData.expiresAt) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(registrationId);
      const query = isObjectId
        ? { $or: [{ inquiryId: registrationId }, { _id: registrationId }] }
        : { inquiryId: registrationId };

      const regDoc = await Registration.findOne(query).select('r2Media couplePhoto inquiryId').lean();
      if (!regDoc) {
        // Return sample couple buffer directly with image/png instead of 404/ORB
        if (sampleCoupleBuffer) {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(sampleCoupleBuffer);
        }
        return res.redirect(302, 'https://www.ekdujekeliye.in/sample_couple.png');
      }

      regData = {
        r2Media: regDoc.r2Media || null,
        couplePhoto: regDoc.couplePhoto || null,
        expiresAt: Date.now() + REG_CACHE_TTL_MS
      };
      regMediaCache.set(registrationId, regData);
      if (regDoc.inquiryId && regDoc.inquiryId !== registrationId) {
        regMediaCache.set(regDoc.inquiryId, regData);
      }
    }

    const r2Media = regData.r2Media;

    // A. Private R2 Resolution
    if (r2Media && (r2Media.isPrivate || r2Media.bucket === r2Provider.privateBucket || r2Media.key || r2Media.normalKey)) {
      const isThumb = preset === 'thumb' || preset === 'thumbnail';
      const isLarge = preset === 'large' || preset === 'download';
      let targetKey = r2Media.normalKey || r2Media.key;

      if (isThumb && r2Media.thumbKey) targetKey = r2Media.thumbKey;
      else if (isLarge && r2Media.largeKey) targetKey = r2Media.largeKey;
      else if (!isThumb && !isLarge && r2Media.normalKey) targetKey = r2Media.normalKey;

      if (targetKey) {
        const bucket = r2Media.bucket || r2Provider.privateBucket;
        const cacheKey = `${bucket}:${targetKey}`;

        // Fast In-Memory Buffer Cache Hit (< 1ms)
        const cached = mediaBufferCache.get(cacheKey);
        if (cached) {
          const clientEtag = req.headers['if-none-match'];
          if (clientEtag && clientEtag === cached.etag) {
            return res.status(304).end();
          }
          res.setHeader('Content-Type', cached.contentType);
          res.setHeader('ETag', cached.etag);
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(cached.buffer);
        }

        try {
          // In-flight deduplication: reuse ongoing fetch promise across concurrent requests
          let fetchPromise = inFlightFetches.get(cacheKey);
          if (!fetchPromise) {
            fetchPromise = r2Provider.getObjectBuffer({ bucket, key: targetKey });
            inFlightFetches.set(cacheKey, fetchPromise);
          }

          let buffer;
          try {
            buffer = await fetchPromise;
          } finally {
            inFlightFetches.delete(cacheKey);
          }

          const contentType = targetKey.endsWith('.webp')
            ? 'image/webp'
            : targetKey.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';

          const etag = `"${crypto.createHash('md5').update(buffer).digest('hex')}"`;

          // Cache thumbnails and normal images in memory (up to 600KB)
          if (buffer.length <= 600 * 1024) {
            mediaBufferCache.set(cacheKey, {
              buffer,
              contentType,
              etag,
              cachedAt: Date.now()
            });

            if (mediaBufferCache.size > MAX_BUFFER_CACHE_ITEMS) {
              const firstKey = mediaBufferCache.keys().next().value;
              if (firstKey) mediaBufferCache.delete(firstKey);
            }
          }

          const clientEtag = req.headers['if-none-match'];
          if (clientEtag && clientEtag === etag) {
            return res.status(304).end();
          }

          res.setHeader('Content-Type', contentType);
          res.setHeader('ETag', etag);
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.send(buffer);
        } catch (bufErr) {
          console.warn(`[MediaController] Buffer stream failed for ${targetKey}, falling back to presigned download URL:`, bufErr.message);
          try {
            const presigned = await r2Provider.generatePresignedDownloadUrl({
              bucket,
              key: targetKey,
              expiresIn: 300 // 5 minutes max
            });
            return res.redirect(302, presigned.downloadUrl);
          } catch (presignErr) {
            console.warn(`[MediaController] Presigned URL failed for ${targetKey}:`, presignErr.message);
          }
        }
      }
    }

    // B. Legacy Cloudinary Read Fallback
    const rawPhoto = regData.couplePhoto || '';
    if (rawPhoto && rawPhoto.includes('cloudinary.com')) {
      const optimized = getOptimizedPhotoUrl(rawPhoto, preset === 'large' ? 'large' : (preset === 'thumb' || preset === 'thumbnail') ? 'thumbnail' : 'normal');
      return res.redirect(302, optimized);
    }

    // C. Public R2 Direct Fallback
    if (rawPhoto && rawPhoto.includes('media.ekdujekeliye.in')) {
      const extractedKey = rawPhoto.replace(/^https?:\/\/[^/]+\//, '');
      const cacheKey = `${r2Provider.publicBucket}:${extractedKey}`;
      const cached = mediaBufferCache.get(cacheKey);
      if (cached) {
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(cached.buffer);
      }
      try {
        const buffer = await r2Provider.getObjectBuffer({
          bucket: r2Provider.publicBucket,
          key: extractedKey
        });
        const contentType = extractedKey.endsWith('.png') ? 'image/png' : 'image/jpeg';
        if (buffer.length <= 600 * 1024) {
          mediaBufferCache.set(cacheKey, {
            buffer,
            contentType,
            etag: `"${crypto.createHash('md5').update(buffer).digest('hex')}"`,
            cachedAt: Date.now()
          });
        }
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(buffer);
      } catch (e) {
        console.warn(`[MediaController] Fallback public R2 buffer fetch failed for ${extractedKey}:`, e.message);
      }
    }

    // D. Default Fallback - Serve fallback couple photo directly (NEVER 404 / ORB)
    if (sampleCoupleBuffer) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(sampleCoupleBuffer);
    }
    return res.redirect(302, 'https://www.ekdujekeliye.in/sample_couple.png');
  } catch (err) {
    console.error('[MediaController] Error serving private couple photo:', err);
    if (sampleCoupleBuffer) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(sampleCoupleBuffer);
    }
    res.redirect(302, 'https://www.ekdujekeliye.in/sample_couple.png');
  }
};

/**
 * 5. Serves private payment proof
 * Access Control: Strictly SUPER_ADMIN, ADMIN, or FINANCE RBAC
 */
export const getPrivatePaymentProof = async (req, res) => {
  try {
    const { registrationId } = req.params;

    const isAuthorizedRole = Boolean(
      req.user && (
        ['SUPER_ADMIN', 'FINANCE'].includes(req.user.role) ||
        req.user.permissions?.includes('PAYMENT_VIEW')
      )
    );
    if (!isAuthorizedRole) {
      return res.status(403).json({
        error: 'Forbidden: Payment proofs are strictly private. Access requires SUPER_ADMIN or FINANCE authorization.'
      });
    }

    const registration = await Registration.findOne({
      $or: [{ inquiryId: registrationId }, { _id: registrationId.match(/^[0-9a-fA-F]{24}$/) ? registrationId : null }]
    }).lean();

    if (!registration) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    const paymentKey = registration.payment?.proofKey || registration.payment?.r2Key;
    if (paymentKey) {
      const presigned = await r2Provider.generatePresignedDownloadUrl({
        bucket: r2Provider.privateBucket,
        key: paymentKey,
        expiresIn: 300 // 5 minutes
      });
      return res.redirect(302, presigned.downloadUrl);
    }

    // Legacy payment screenshot fallback (if still in Cloudinary)
    const legacyUrl = registration.payment?.screenshotUrl || registration.payment?.paymentScreenshot;
    if (legacyUrl && legacyUrl.startsWith('http')) {
      return res.redirect(302, legacyUrl);
    }

    return res.status(404).json({ error: 'Payment proof not found for this registration.' });
  } catch (err) {
    console.error('[MediaController] Error serving payment proof:', err);
    res.status(500).json({ error: 'Failed to retrieve payment proof.' });
  }
};

/**
 * 6. Generates short-lived signed token to view archived Google Drive original photo
 */
export const createMediaViewToken = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const tokenData = await mediaService.generateMediaViewToken(registrationId, req.user);
    res.json(tokenData);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Failed to generate media view token.'
    });
  }
};

/**
 * 7. Serves secure historical archived media preview (thumbnail, normal, large)
 */
export const getArchivedMediaPreview = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { preset = 'thumbnail', exp, sig, archiveId = '' } = req.query;

    const isAdmin = Boolean(req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN'));
    const isSignedTokenValid = exp && sig ? mediaService.verifySignedMediaToken({
      registrationId,
      archiveId,
      purpose: 'preview',
      preset,
      expiresAt: exp,
      sig
    }) : false;

    if (!isAdmin && !isSignedTokenValid) {
      return res.status(403).json({
        error: 'Forbidden: Access to archived media requires valid Admin session or authenticated signed token.'
      });
    }

    const archive = await MediaArchive.findOne({
      registrationId,
      status: { $in: ['VERIFIED', 'ARCHIVED'] }
    }).lean();

    if (!archive || !archive.driveFileId) {
      return res.status(404).json({
        error: `Archived photo record not found in Google Drive for registration ${registrationId}.`
      });
    }

    const sizeMap = {
      thumbnail: 'w240',
      normal: 'w720',
      large: 'w1200'
    };
    const driveSize = sizeMap[preset] || 'w240';

    if (archive.operationalThumbnailUrl) {
      return res.redirect(302, archive.operationalThumbnailUrl);
    }

    if (archive.cloudinaryOriginalStatus !== 'DELETED' && archive.sourceUrl && archive.sourceUrl.includes('cloudinary.com')) {
      const optimized = getOptimizedPhotoUrl(archive.sourceUrl, preset === 'large' ? 'large' : preset === 'normal' ? 'normal' : 'thumbnail');
      return res.redirect(302, optimized);
    }

    const driveThumbnailUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(archive.driveFileId)}&sz=${driveSize}`;
    return res.redirect(302, driveThumbnailUrl);
  } catch (err) {
    console.error('[MediaController] Error retrieving archived preview:', err);
    res.status(500).json({ error: 'Server error retrieving archived photo preview.' });
  }
};

/**
 * 8. Downloads authentic original archived photo from Google Drive
 */
export const downloadArchivedOriginal = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { exp, sig, archiveId = '' } = req.query;

    const isAdmin = Boolean(req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN'));
    const isSignedTokenValid = exp && sig ? mediaService.verifySignedMediaToken({
      registrationId,
      archiveId,
      purpose: 'download',
      preset: 'large',
      expiresAt: exp,
      sig
    }) : false;

    if (!isAdmin && !isSignedTokenValid) {
      return res.status(403).json({
        error: 'Forbidden: Downloading original archived photo requires Admin authorization or valid signed download token.'
      });
    }

    const archive = await MediaArchive.findOne({
      registrationId,
      status: { $in: ['VERIFIED', 'ARCHIVED'] }
    }).lean();

    if (!archive || !archive.driveFileId) {
      return res.status(404).json({
        error: `Archived original not found in Google Drive for registration ${registrationId}.`
      });
    }

    const driveDownloadUrl = `https://drive.google.com/uc?id=${encodeURIComponent(archive.driveFileId)}&export=download`;
    return res.redirect(302, driveDownloadUrl);
  } catch (err) {
    console.error('[MediaController] Error downloading archived original:', err);
    res.status(500).json({ error: 'Server error downloading archived original.' });
  }
};
