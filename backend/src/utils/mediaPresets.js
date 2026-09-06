/**
 * Centralized Media Presets and Deterministic URL Optimizer
 * 
 * Enforces exactly 3 fixed Cloudinary transformation buckets:
 * - thumbnail: c_limit,w_240,q_auto,f_auto (~15-25 KB)
 * - normal:    c_limit,w_720,q_auto,f_auto (~80-120 KB)
 * - large:     c_limit,w_1200,q_auto,f_auto (~250-350 KB)
 * 
 * Strictly replaces any existing transformations without chaining or duplicating.
 * Preserves non-Cloudinary, Drive, local, and data URLs unchanged.
 */

export const MEDIA_PRESETS = {
  thumbnail: 'c_limit,w_240,q_auto,f_auto',
  normal: 'c_limit,w_720,q_auto,f_auto',
  large: 'c_limit,w_1200,q_auto,f_auto'
};

/**
 * Checks if a path segment is a Cloudinary transformation parameter chunk.
 * E.g. "w_240", "c_limit,w_720,q_auto,f_auto", "h_300,w_400"
 */
function isTransformationSegment(segment) {
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
 * @param {string} url - Original image URL
 * @param {'thumbnail' | 'normal' | 'large'} preset - Target preset
 * @returns {string} Optimized URL
 */
export function getOptimizedPhotoUrl(url, preset = 'thumbnail') {
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
