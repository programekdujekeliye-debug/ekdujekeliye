import { mediaService } from './media.service.js';
import { MediaArchive } from '../../models/MediaArchive.js';
import { getOptimizedPhotoUrl } from '../../utils/mediaPresets.js';

/**
 * Generates short-lived signed token to view archived Google Drive original photo
 * Protected by requireAuth (Normal Admin & Super Admin)
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
 * Serves secure historical archived media preview (thumbnail, normal, large)
 * Access Control: Requires authenticated Admin session OR valid short-lived HMAC-signed token.
 */
export const getArchivedMediaPreview = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { preset = 'thumbnail', exp, sig, archiveId = '' } = req.query;

    // 1. Authorization: Authenticated Admin session OR valid HMAC signature
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

    // 2. Lookup verified MediaArchive record
    const archive = await MediaArchive.findOne({
      registrationId,
      status: { $in: ['VERIFIED', 'ARCHIVED'] }
    }).lean();

    if (!archive || !archive.driveFileId) {
      return res.status(404).json({
        error: `Archived photo record not found in Google Drive for registration ${registrationId}.`
      });
    }

    // 3. Resolve destination URL based on preset
    const sizeMap = {
      thumbnail: 'w240',
      normal: 'w720',
      large: 'w1200'
    };
    const driveSize = sizeMap[preset] || 'w240';

    // Prioritize independent operational thumbnail if already created
    if (archive.operationalThumbnailUrl) {
      return res.redirect(302, archive.operationalThumbnailUrl);
    }

    // If original Cloudinary asset is still active and not marked DELETED, use optimized Cloudinary URL
    if (archive.cloudinaryOriginalStatus !== 'DELETED' && archive.sourceUrl && archive.sourceUrl.includes('cloudinary.com')) {
      const optimized = getOptimizedPhotoUrl(archive.sourceUrl, preset === 'large' ? 'large' : preset === 'normal' ? 'normal' : 'thumbnail');
      return res.redirect(302, optimized);
    }

    // Direct Google Drive CDN thumbnail preview (Zero Cloudinary dependency)
    const driveThumbnailUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(archive.driveFileId)}&sz=${driveSize}`;
    return res.redirect(302, driveThumbnailUrl);

  } catch (err) {
    console.error('[MediaController] Error retrieving archived preview:', err);
    res.status(500).json({ error: 'Server error retrieving archived photo preview.' });
  }
};

/**
 * Downloads authentic original archived photo from Google Drive
 * Access Control: Strictly Admin-only OR valid short-lived HMAC signed download token.
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

    // Secure Drive original download link
    const driveDownloadUrl = `https://drive.google.com/uc?id=${encodeURIComponent(archive.driveFileId)}&export=download`;
    return res.redirect(302, driveDownloadUrl);

  } catch (err) {
    console.error('[MediaController] Error downloading archived original:', err);
    res.status(500).json({ error: 'Server error downloading archived original.' });
  }
};
