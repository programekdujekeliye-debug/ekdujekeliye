/**
 * Centralized Media Presets and Deterministic URL Optimizer (Frontend)
 * 
 * Enforces exactly 3 fixed Cloudinary transformation buckets:
 * - thumbnail: c_limit,w_240,q_auto,f_auto (~15-25 KB) - for list items, tables, avatars, chat items
 * - normal:    c_limit,w_720,q_auto,f_auto (~80-120 KB) - for modals, scanner review cards, feedback inspect
 * - large:     c_limit,w_1200,q_auto,f_auto (~250-350 KB) - for high-res photo frame download / export
 * 
 * Strictly replaces any existing transformations without chaining or duplicating.
 * Preserves non-Cloudinary, Drive, local, and data URLs unchanged.
 */

import { API_BASE_URL } from '@/config';

export const MEDIA_PRESETS = {
  thumbnail: 'c_limit,w_240,q_auto,f_auto',
  normal: 'c_limit,w_720,q_auto,f_auto',
  large: 'c_limit,w_1200,q_auto,f_auto'
} as const;

export type MediaPreset = keyof typeof MEDIA_PRESETS;

/**
 * Checks if a path segment is a Cloudinary transformation parameter chunk.
 * E.g. "w_240", "c_limit,w_720,q_auto,f_auto", "h_300,w_400"
 */
function isTransformationSegment(segment: string): boolean {
  if (!segment) return false;
  // Cloudinary version tag is NOT a transformation
  if (/^v\d+$/.test(segment)) return false;
  
  // Known Cloudinary transformation keys (1-4 chars followed by underscore)
  const knownKeys = ['w_', 'h_', 'c_', 'q_', 'f_', 'dpr_', 'ar_', 'b_', 'g_', 'r_', 'e_', 'o_', 'l_', 'u_', 'z_', 'co_', 'pg_'];
  const parts = segment.split(',');
  return parts.every(part => knownKeys.some(k => part.trim().startsWith(k)));
}

/**
 * Returns a deterministic optimized Cloudinary URL for a given preset.
 * 
 * @param url - Original image URL
 * @param preset - Target preset ('thumbnail' | 'normal' | 'large')
 * @returns Optimized URL
 */
export function getOptimizedPhotoUrl(url: string | null | undefined, preset: MediaPreset = 'thumbnail'): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Non-Cloudinary URLs must remain completely untouched
  if (!trimmed.includes('res.cloudinary.com') || !trimmed.includes('/upload/')) {
    return trimmed;
  }

  const transformString = MEDIA_PRESETS[preset] || MEDIA_PRESETS.thumbnail;

  // Split by /upload/
  const uploadIndex = trimmed.indexOf('/upload/');
  const prefix = trimmed.substring(0, uploadIndex + 8); // includes "/upload/"
  const remainder = trimmed.substring(uploadIndex + 8);

  const segments = remainder.split('/');
  
  // Skip any leading transformation segments
  let assetStartIndex = 0;
  while (assetStartIndex < segments.length && isTransformationSegment(segments[assetStartIndex])) {
    assetStartIndex++;
  }

  const cleanAssetPath = segments.slice(assetStartIndex).join('/');
  return `${prefix}${transformString}/${cleanAssetPath}`;
}

export interface CanonicalMediaResult {
  provider: 'CLOUDINARY' | 'DRIVE_ARCHIVE' | 'R2' | 'FALLBACK';
  thumbnailUrl: string;
  normalUrl: string;
  largeUrl: string;
  downloadUrl: string;
  canDownloadOriginal: boolean;
}

/**
 * Canonical frontend media resolver:
 * Determines appropriate photo asset representation without manual component branch logic.
 */
export function resolveRegistrationPhoto(
  registration: {
    couplePhoto?: string | null;
    photoThumbnailUrl?: string | null;
    thumbnailUrl?: string | null;
    normalUrl?: string | null;
    largeUrl?: string | null;
    downloadUrl?: string | null;
    inquiryId?: string;
    hasArchivedOriginal?: boolean;
    provider?: 'CLOUDINARY' | 'DRIVE_ARCHIVE' | 'R2' | 'FALLBACK';
  },
  event?: { status?: string; date?: string } | null,
  archive?: { status?: string; driveFileId?: string } | null
): CanonicalMediaResult {
  // If backend already resolved canonical provider and URLs:
  if (registration.provider) {
    return {
      provider: registration.provider,
      thumbnailUrl: registration.photoThumbnailUrl || registration.thumbnailUrl || '',
      normalUrl: registration.couplePhoto || registration.normalUrl || '',
      largeUrl: registration.largeUrl || registration.couplePhoto || '',
      downloadUrl: registration.downloadUrl || registration.couplePhoto || '',
      canDownloadOriginal: Boolean(registration.downloadUrl)
    };
  }

  const isCompleted = event?.status === 'completed' || event?.status === 'archived';
  const hasArchive = Boolean(registration.hasArchivedOriginal || (archive && (archive.status === 'VERIFIED' || archive.status === 'ARCHIVED') && archive.driveFileId));

  if (isCompleted && hasArchive && registration.inquiryId) {
    const regId = encodeURIComponent(registration.inquiryId);
    return {
      provider: 'DRIVE_ARCHIVE',
      thumbnailUrl: `/api/admin/media/${regId}/preview?preset=thumbnail`,
      normalUrl: `/api/admin/media/${regId}/preview?preset=normal`,
      largeUrl: `/api/admin/media/${regId}/preview?preset=large`,
      downloadUrl: `/api/admin/media/${regId}/download`,
      canDownloadOriginal: true
    };
  }

  const rawPhoto = registration.couplePhoto || '';

  // Cloudflare R2 direct public CDN URL
  if (rawPhoto.includes('media.ekdujekeliye.in') || rawPhoto.includes('.r2.cloudflarestorage.com')) {
    return {
      provider: 'R2',
      thumbnailUrl: registration.photoThumbnailUrl || registration.thumbnailUrl || rawPhoto,
      normalUrl: rawPhoto,
      largeUrl: registration.largeUrl || rawPhoto,
      downloadUrl: registration.downloadUrl || rawPhoto,
      canDownloadOriginal: true
    };
  }

  if (rawPhoto.includes('res.cloudinary.com')) {
    return {
      provider: 'CLOUDINARY',
      thumbnailUrl: getOptimizedPhotoUrl(rawPhoto, 'thumbnail'),
      normalUrl: getOptimizedPhotoUrl(rawPhoto, 'normal'),
      largeUrl: getOptimizedPhotoUrl(rawPhoto, 'large'),
      downloadUrl: getOptimizedPhotoUrl(rawPhoto, 'large'),
      canDownloadOriginal: true
    };
  }

  return {
    provider: 'FALLBACK',
    thumbnailUrl: '/sample_couple.png',
    normalUrl: '/sample_couple.png',
    largeUrl: '/sample_couple.png',
    downloadUrl: '',
    canDownloadOriginal: false
  };
}

/**
 * Resolves any image path into a safe, full display URL.
 * Strictly avoids prefixing API_BASE_URL onto local static assets (/sample_couple.png, /logo.png).
 */
export function resolveDisplayImageUrl(
  url: string | null | undefined,
  preset: MediaPreset = 'thumbnail'
): string {
  if (!url || typeof url !== 'string') return '/sample_couple.png';
  const trimmed = url.trim();
  if (!trimmed) return '/sample_couple.png';

  // Local static public assets in frontend (never prefix with backend API_BASE_URL)
  if (
    trimmed.startsWith('/sample_couple.png') ||
    trimmed.startsWith('/logo.png') ||
    trimmed.startsWith('/frame_template.png') ||
    trimmed.startsWith('/card_template.png')
  ) {
    return trimmed;
  }

  // Data or blob URIs
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Remote HTTP/HTTPS URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return getOptimizedPhotoUrl(trimmed, preset);
  }

  // Backend relative endpoints (e.g. /api/media/...)
  return `${API_BASE_URL}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

