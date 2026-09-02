import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET
});

export class CloudinaryStorageProvider {
  /**
   * Upload image data buffer / base64 string to Cloudinary
   * @param {Object} params - { data, folder, filename }
   */
  async upload({ data, folder = 'ekdujekeliye', filename = null }) {
    if (!data) return null;
    if (typeof data === 'string' && (data.startsWith('http://') || data.startsWith('https://'))) {
      return data;
    }

    try {
      const options = {
        folder,
        resource_type: 'image',
        format: 'jpg'
      };
      if (filename) options.public_id = filename;

      const result = await cloudinary.uploader.upload(data, options);
      return result.secure_url;
    } catch (err) {
      console.error('[Cloudinary Provider] Upload error:', err);
      throw err;
    }
  }

  async delete(publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
      return true;
    } catch (err) {
      console.error('[Cloudinary Provider] Deletion error:', err);
      return false;
    }
  }

  async getUrl(publicId) {
    return cloudinary.url(publicId, { secure: true });
  }
}

export const cloudinaryProvider = new CloudinaryStorageProvider();
