import crypto from 'crypto';
import { Registration } from '../../models/Registration.js';
import { MediaArchive } from '../../models/MediaArchive.js';
import { Event } from '../../models/Event.js';
import { env } from '../../config/env.js';
import { getOptimizedPhotoUrl } from '../../utils/mediaPresets.js';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET
});

export class MediaService {
  /**
   * Transforms a full Cloudinary URL into a fast, lightweight thumbnail transformation
   */
  getThumbnailUrl(rawUrl) {
    return getOptimizedPhotoUrl(rawUrl, 'thumbnail');
  }

  /**
   * Creates an independent operational thumbnail on Cloudinary (approx 400px, auto-format, ~20-80KB)
   * Stored under folder: archive-thumbnails/{eventSlug}/{inquiryId}
   * Never overwritten or derived solely from original.
   */
  async createOperationalThumbnail({ sourceUrl, eventSlug = 'general', inquiryId, publicId = null }) {
    if (!sourceUrl) {
      throw new Error('sourceUrl is required to create operational thumbnail.');
    }
    if (!inquiryId) {
      throw new Error('inquiryId is required to create operational thumbnail.');
    }

    const safeSlug = String(eventSlug || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetFolder = `archive-thumbnails/${safeSlug}`;
    const targetPublicId = `${targetFolder}/${inquiryId}`;

    // Upload an independent transformed asset to Cloudinary
    if (env.MEDIA_WRITE_PROVIDER === 'r2') {
      throw new Error('[MediaService] Operational thumbnail writes to Cloudinary are strictly frozen when MEDIA_WRITE_PROVIDER is r2.');
    }
    const uploadResult = await cloudinary.uploader.upload(sourceUrl, {
      public_id: inquiryId,
      folder: targetFolder,
      overwrite: true,
      resource_type: 'image',
      transformation: [
        { width: 400, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }
      ]
    });

    const operationalThumbnailUrl = uploadResult.secure_url;
    const operationalThumbnailPublicId = uploadResult.public_id;
    const thumbnailSizeBytes = uploadResult.bytes || 0;

    // Verify independent thumbnail returns HTTP 200
    const headRes = await fetch(operationalThumbnailUrl, { method: 'HEAD' });
    if (headRes.status !== 200) {
      throw new Error(`Operational thumbnail verification failed: HTTP ${headRes.status}`);
    }

    return {
      operationalThumbnailUrl,
      operationalThumbnailPublicId,
      thumbnailSizeBytes,
      thumbnailCreatedAt: new Date(),
      format: uploadResult.format,
      width: uploadResult.width,
      height: uploadResult.height
    };
  }

  /**
   * Generates short-lived signed HMAC token for secure media preview or download
   */
  generateSignedMediaToken({ registrationId, archiveId = '', purpose = 'preview', preset = 'thumbnail', expiresIn = 1800 }) {
    const secret = env.GOOGLE_MEDIA_VIEW_SECRET || 'edkl_default_media_secret_fallback';
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    const message = `${registrationId}:${archiveId}:${purpose}:${preset}:${expiresAt}`;
    const sig = crypto.createHmac('sha256', secret).update(message).digest('hex');
    return { expiresAt, sig };
  }

  /**
   * Cryptographically verifies signed media token
   */
  verifySignedMediaToken({ registrationId, archiveId = '', purpose = 'preview', preset = 'thumbnail', expiresAt, sig }) {
    if (!expiresAt || !sig) return false;
    const expNum = Number(expiresAt);
    if (isNaN(expNum) || Math.floor(Date.now() / 1000) > expNum) return false;
    const secret = env.GOOGLE_MEDIA_VIEW_SECRET || 'edkl_default_media_secret_fallback';

    const candidatePresets = [preset, 'any'];
    if (preset === 'thumb') candidatePresets.push('thumbnail');
    if (preset === 'thumbnail') candidatePresets.push('thumb');

    for (const candPreset of candidatePresets) {
      const message = `${registrationId}:${archiveId}:${purpose}:${candPreset}:${expNum}`;
      const expectedSig = crypto.createHmac('sha256', secret).update(message).digest('hex');
      try {
        if (crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
          return true;
        }
      } catch (e) {}
    }
    return false;
  }

  /**
   * Canonical media resolver: synchronous helper when archive & event are preloaded
   * Enforces strict Resolution Order:
   * ACTIVE EVENT:
   *   IF R2_PRIMARY: R2
   *   ELSE IF Cloudinary available: CLOUDINARY
   *   ELSE IF R2 available: R2
   *   ELSE: FALLBACK
   * HISTORICAL EVENT:
   *   IF Drive VERIFIED: DRIVE_ARCHIVE
   *   ELSE IF R2 exists: R2
   *   ELSE IF Cloudinary exists: CLOUDINARY
   *   ELSE: FALLBACK
   */
  resolveRegistrationMediaSync(registration, archive = null, eventObj = null) {
    const rawPhoto = registration.couplePhoto || '';
    const isCompleted = eventObj?.status === 'completed' || eventObj?.status === 'archived' || (eventObj?.date && eventObj.date < '2026-09-01' && eventObj.date !== 'TBD');
    const isVerifiedArchive = archive && (archive.status === 'VERIFIED' || archive.status === 'ARCHIVED') && Boolean(archive.driveFileId);
    const isOriginalDeleted = archive && archive.cloudinaryOriginalStatus === 'DELETED';

    const r2Media = registration.r2Media || archive?.r2Media;
    const hasR2 = Boolean(r2Media?.normalUrl || r2Media?.key || r2Media?.normalKey || (rawPhoto && rawPhoto.includes('media.ekdujekeliye.in')));
    const isR2Primary = hasR2 && (registration.mediaProvider === 'R2' || r2Media?.status === 'R2_PRIMARY' || rawPhoto.includes('media.ekdujekeliye.in'));
    const isCloudinaryAvailable = Boolean(rawPhoto && rawPhoto.includes('cloudinary.com') && !isOriginalDeleted);

    // ========================================================
    // A. ACTIVE EVENT (EK06, EK07, EK08, Future)
    // ========================================================
    if (!isCompleted) {
      // 1. IF R2_PRIMARY: R2
      if (isR2Primary) {
        let thumbUrl = r2Media?.thumbUrl || rawPhoto;
        let normUrl = r2Media?.normalUrl || rawPhoto;
        let lrgUrl = r2Media?.largeUrl || normUrl;

        // If couple photo is private or references internal media.ekdujekeliye.in, route access through authenticated secure backend endpoints with signed token
        if (r2Media?.isPrivate || rawPhoto.includes('media.ekdujekeliye.in')) {
          const regId = registration.inquiryId || registration._id;
          const token = this.generateSignedMediaToken({
            registrationId: regId,
            purpose: 'couple_photo',
            preset: 'any',
            expiresIn: 604800 // 7 days
          });
          const qs = `exp=${token.expiresAt}&sig=${token.sig}`;
          thumbUrl = `/api/media/${encodeURIComponent(regId)}/couple-photo?preset=thumb&${qs}`;
          normUrl = `/api/media/${encodeURIComponent(regId)}/couple-photo?preset=normal&${qs}`;
          lrgUrl = `/api/media/${encodeURIComponent(regId)}/couple-photo?preset=large&${qs}`;
        }

        return {
          provider: 'R2',
          photoThumbnailUrl: thumbUrl,
          couplePhoto: normUrl,
          thumbnailUrl: thumbUrl,
          normalUrl: normUrl,
          largeUrl: lrgUrl,
          canDownloadOriginal: true,
          downloadUrl: lrgUrl,
          photoStorageStatus: 'ACTIVE',
          hasArchivedOriginal: false,
          archiveStatus: archive ? archive.status : null,
          cloudinaryOriginalStatus: archive?.cloudinaryOriginalStatus || 'ACTIVE',
          operationalThumbnailUrl: archive?.operationalThumbnailUrl || null
        };
      }

      // 2. ELSE IF Cloudinary available: CLOUDINARY
      if (isCloudinaryAvailable) {
        const thumbnailUrl = getOptimizedPhotoUrl(rawPhoto, 'thumbnail');
        const normalUrl = getOptimizedPhotoUrl(rawPhoto, 'normal');
        const largeUrl = getOptimizedPhotoUrl(rawPhoto, 'large');
        return {
          provider: 'CLOUDINARY',
          photoThumbnailUrl: thumbnailUrl,
          couplePhoto: normalUrl || rawPhoto,
          thumbnailUrl,
          normalUrl,
          largeUrl,
          canDownloadOriginal: true,
          downloadUrl: largeUrl,
          photoStorageStatus: 'ACTIVE',
          hasArchivedOriginal: false,
          archiveStatus: archive ? archive.status : null,
          cloudinaryOriginalStatus: archive?.cloudinaryOriginalStatus || 'ACTIVE',
          operationalThumbnailUrl: archive?.operationalThumbnailUrl || null
        };
      }

      // 3. ELSE IF R2 exists: R2
      if (hasR2) {
        let thumbUrl = r2Media?.thumbUrl || rawPhoto;
        let normUrl = r2Media?.normalUrl || rawPhoto;
        let lrgUrl = r2Media?.largeUrl || normUrl;

        if (r2Media?.isPrivate || rawPhoto.includes('media.ekdujekeliye.in')) {
          const regId = registration.inquiryId || registration._id;
          const token = this.generateSignedMediaToken({
            registrationId: regId,
            purpose: 'couple_photo',
            preset: 'any',
            expiresIn: 604800 // 7 days
          });
          const qs = `exp=${token.expiresAt}&sig=${token.sig}`;
          thumbUrl = `/api/media/${encodeURIComponent(regId)}/couple-photo?preset=thumb&${qs}`;
          normUrl = `/api/media/${encodeURIComponent(regId)}/couple-photo?preset=normal&${qs}`;
          lrgUrl = `/api/media/${encodeURIComponent(regId)}/couple-photo?preset=large&${qs}`;
        }

        return {
          provider: 'R2',
          photoThumbnailUrl: thumbUrl,
          couplePhoto: normUrl,
          thumbnailUrl: thumbUrl,
          normalUrl: normUrl,
          largeUrl: lrgUrl,
          canDownloadOriginal: true,
          downloadUrl: lrgUrl,
          photoStorageStatus: 'ACTIVE',
          hasArchivedOriginal: false,
          archiveStatus: archive ? archive.status : null,
          cloudinaryOriginalStatus: archive?.cloudinaryOriginalStatus || 'ACTIVE',
          operationalThumbnailUrl: archive?.operationalThumbnailUrl || null
        };
      }

      // 4. ELSE: FALLBACK
      return {
        provider: 'FALLBACK',
        photoThumbnailUrl: '/sample_couple.png',
        couplePhoto: '/sample_couple.png',
        thumbnailUrl: '/sample_couple.png',
        normalUrl: '/sample_couple.png',
        largeUrl: '/sample_couple.png',
        canDownloadOriginal: false,
        downloadUrl: null,
        photoStorageStatus: 'ACTIVE',
        hasArchivedOriginal: false,
        archiveStatus: archive ? archive.status : null,
        cloudinaryOriginalStatus: 'DELETED',
        operationalThumbnailUrl: null
      };
    }

    // ========================================================
    // B. HISTORICAL EVENT
    // ========================================================
    // 1. IF Drive VERIFIED: DRIVE_ARCHIVE
    if (isVerifiedArchive && registration.inquiryId) {
      const regId = registration.inquiryId;
      const archiveId = archive._id ? archive._id.toString() : '';

      const thumbToken = this.generateSignedMediaToken({ registrationId: regId, archiveId, purpose: 'preview', preset: 'thumbnail' });
      const normalToken = this.generateSignedMediaToken({ registrationId: regId, archiveId, purpose: 'preview', preset: 'normal' });
      const largeToken = this.generateSignedMediaToken({ registrationId: regId, archiveId, purpose: 'preview', preset: 'large' });
      const downloadToken = this.generateSignedMediaToken({ registrationId: regId, archiveId, purpose: 'download', preset: 'large' });

      const thumbnailUrl = `/api/admin/media/${encodeURIComponent(regId)}/preview?preset=thumbnail&exp=${thumbToken.expiresAt}&sig=${thumbToken.sig}`;
      const normalUrl = `/api/admin/media/${encodeURIComponent(regId)}/preview?preset=normal&exp=${normalToken.expiresAt}&sig=${normalToken.sig}`;
      const largeUrl = `/api/admin/media/${encodeURIComponent(regId)}/preview?preset=large&exp=${largeToken.expiresAt}&sig=${largeToken.sig}`;
      const downloadUrl = `/api/admin/media/${encodeURIComponent(regId)}/download?exp=${downloadToken.expiresAt}&sig=${downloadToken.sig}`;

      return {
        provider: 'DRIVE_ARCHIVE',
        photoThumbnailUrl: thumbnailUrl,
        couplePhoto: normalUrl,
        thumbnailUrl,
        normalUrl,
        largeUrl,
        canDownloadOriginal: true,
        downloadUrl,
        photoStorageStatus: 'ARCHIVED',
        hasArchivedOriginal: true,
        archiveStatus: archive.status,
        cloudinaryOriginalStatus: archive.cloudinaryOriginalStatus || 'ACTIVE',
        operationalThumbnailUrl: archive.operationalThumbnailUrl || null
      };
    }

    // 2. ELSE IF R2 exists: R2
    if (hasR2) {
      const thumbUrl = r2Media?.thumbUrl || rawPhoto;
      const normUrl = r2Media?.normalUrl || rawPhoto;
      const lrgUrl = r2Media?.largeUrl || normUrl;
      return {
        provider: 'R2',
        photoThumbnailUrl: thumbUrl,
        couplePhoto: normUrl,
        thumbnailUrl: thumbUrl,
        normalUrl: normUrl,
        largeUrl: lrgUrl,
        canDownloadOriginal: true,
        downloadUrl: lrgUrl,
        photoStorageStatus: 'ARCHIVED',
        hasArchivedOriginal: false,
        archiveStatus: archive ? archive.status : null,
        cloudinaryOriginalStatus: archive?.cloudinaryOriginalStatus || 'ACTIVE',
        operationalThumbnailUrl: archive?.operationalThumbnailUrl || null
      };
    }

    // 3. ELSE IF Cloudinary exists: CLOUDINARY
    if (isCloudinaryAvailable) {
      const thumbnailUrl = getOptimizedPhotoUrl(rawPhoto, 'thumbnail');
      const normalUrl = getOptimizedPhotoUrl(rawPhoto, 'normal');
      const largeUrl = getOptimizedPhotoUrl(rawPhoto, 'large');
      return {
        provider: 'CLOUDINARY',
        photoThumbnailUrl: thumbnailUrl,
        couplePhoto: normalUrl || rawPhoto,
        thumbnailUrl,
        normalUrl,
        largeUrl,
        canDownloadOriginal: true,
        downloadUrl: largeUrl,
        photoStorageStatus: 'ARCHIVED',
        hasArchivedOriginal: false,
        archiveStatus: archive ? archive.status : null,
        cloudinaryOriginalStatus: archive?.cloudinaryOriginalStatus || 'ACTIVE',
        operationalThumbnailUrl: archive?.operationalThumbnailUrl || null
      };
    }

    // 4. ELSE: FALLBACK
    const fallbackUrl = (isOriginalDeleted || !rawPhoto) ? '/sample_couple.png' : rawPhoto;
    const fallbackThumb = (isOriginalDeleted || !rawPhoto) ? '/sample_couple.png' : getOptimizedPhotoUrl(rawPhoto, 'thumbnail');
    return {
      provider: 'FALLBACK',
      photoThumbnailUrl: fallbackThumb,
      couplePhoto: fallbackUrl,
      thumbnailUrl: fallbackThumb,
      normalUrl: fallbackUrl,
      largeUrl: fallbackUrl,
      canDownloadOriginal: !isOriginalDeleted && Boolean(rawPhoto),
      downloadUrl: (!isOriginalDeleted && rawPhoto) ? rawPhoto : null,
      photoStorageStatus: archive ? (archive.status === 'QUEUED' || archive.status === 'COPYING' ? 'QUEUED' : archive.status) : 'ACTIVE',
      hasArchivedOriginal: Boolean(archive?.driveFileId),
      archiveStatus: archive ? archive.status : null,
      cloudinaryOriginalStatus: archive?.cloudinaryOriginalStatus || (isOriginalDeleted ? 'DELETED' : 'ACTIVE'),
      operationalThumbnailUrl: archive?.operationalThumbnailUrl || null
    };
  }

  /**
   * Resolves safe media state for a registration with canonical media rules
   */
  async resolveRegistrationMedia(registration, archiveRecord = null, eventObj = null) {
    let archive = archiveRecord;
    if (!archive && registration.inquiryId) {
      archive = await MediaArchive.findOne({
        registrationId: registration.inquiryId
      }).select('status driveFileId filename verifiedAt operationalThumbnailUrl operationalThumbnailPublicId cloudinaryOriginalStatus').lean();
    }

    let event = eventObj;
    if (!event && registration.programId) {
      event = await Event.findOne({
        $or: [{ id: registration.programId }, { slug: registration.programId }]
      }).select('status date id slug').lean();
    }

    return this.resolveRegistrationMediaSync(registration, archive, event);
  }

  /**
   * Generates a short-lived (3 min) HMAC-SHA256 signed access token for Google Drive original photo viewing
   * Strictly enforces Normal Admin vs Super Admin event authorization.
   */
  async generateMediaViewToken(registrationId, user) {
    if (!registrationId) {
      throw { status: 400, message: 'registrationId is required.' };
    }

    const registration = await Registration.findOne({
      inquiryId: registrationId,
      isDeleted: { $ne: true }
    }).lean();

    if (!registration) {
      throw { status: 404, message: `Registration ${registrationId} not found.` };
    }

    // Enforce Event Authorization for Normal Admin
    if (user.role !== 'SUPER_ADMIN') {
      const assigned = user.assignedEventIds || [];
      if (assigned.length > 0 && !assigned.includes(registration.programId)) {
        throw { status: 403, message: 'You are not authorized to view media for this event.' };
      }
    }

    // Find verified MediaArchive record
    const archive = await MediaArchive.findOne({
      registrationId,
      status: { $in: ['VERIFIED', 'ARCHIVED'] }
    }).lean();

    if (!archive || !archive.driveFileId) {
      throw { status: 404, message: 'Archived original photo is not available in Google Drive for this registration.' };
    }

    const secret = env.GOOGLE_MEDIA_VIEW_SECRET;
    if (!secret) {
      throw { status: 500, message: 'GOOGLE_MEDIA_VIEW_SECRET is not configured on server.' };
    }

    const fileId = archive.driveFileId;
    const exp = Math.floor(Date.now() / 1000) + 180; // 3 minutes expiration
    const nonce = crypto.randomBytes(8).toString('hex');
    const message = `${registrationId}:${fileId}:${exp}:${nonce}`;

    const sig = crypto.createHmac('sha256', secret).update(message).digest('hex');

    const baseUrl = (env.APPS_SCRIPT_VIEWER_URL || '').trim();
    const queryParams = new URLSearchParams({
      action: 'viewArchivedPhoto',
      registrationId,
      fileId,
      exp: String(exp),
      nonce,
      sig
    });

    const viewerUrl = baseUrl ? `${baseUrl}?${queryParams.toString()}` : `?${queryParams.toString()}`;

    return {
      success: true,
      registrationId,
      fileId,
      filename: archive.filename,
      expiresAt: exp,
      nonce,
      signature: sig,
      viewerUrl
    };
  }
}

export const mediaService = new MediaService();
