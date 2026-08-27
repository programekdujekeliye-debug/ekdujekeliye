import crypto from 'crypto';
import { Registration } from '../../models/Registration.js';
import { MediaArchive } from '../../models/MediaArchive.js';
import { Event } from '../../models/Event.js';
import { env } from '../../config/env.js';

export class MediaService {
  /**
   * Transforms a full Cloudinary URL into a fast, lightweight thumbnail transformation
   */
  getThumbnailUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    if (!rawUrl.includes('cloudinary.com') || !rawUrl.includes('/upload/')) {
      return rawUrl;
    }
    // Inject lightweight thumbnail transformation params: c_limit,w_400,q_auto,f_auto
    return rawUrl.replace('/upload/', '/upload/c_limit,w_400,q_auto,f_auto/');
  }

  /**
   * Resolves safe media state for a registration without exposing raw Drive identifiers
   */
  async resolveRegistrationMedia(registration, archiveRecord = null) {
    const rawPhoto = registration.couplePhoto || '';
    const thumbnailUrl = this.getThumbnailUrl(rawPhoto);

    let archive = archiveRecord;
    if (!archive && registration.inquiryId) {
      archive = await MediaArchive.findOne({
        registrationId: registration.inquiryId
      }).select('status driveFileId filename verifiedAt').lean();
    }

    const isArchived = archive && (archive.status === 'VERIFIED' || archive.status === 'ARCHIVED');
    const isQueued = archive && (archive.status === 'QUEUED' || archive.status === 'COPYING');

    return {
      photoThumbnailUrl: thumbnailUrl,
      photoStorageStatus: isArchived ? 'ARCHIVED' : (isQueued ? 'QUEUED' : 'ACTIVE'),
      hasArchivedOriginal: Boolean(isArchived && archive.driveFileId),
      archiveStatus: archive ? archive.status : null
    };
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
