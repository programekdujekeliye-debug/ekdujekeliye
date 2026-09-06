import { cloudinaryProvider } from '../integrations/cloudinary/cloudinary.provider.js';
import { googleDriveProvider } from '../integrations/google-drive/google-drive.provider.js';
import { r2Provider } from '../integrations/r2/r2.provider.js';
import { env } from '../config/env.js';

export class StorageService {
  constructor() {
    this.defaultProvider = (env.MEDIA_WRITE_PROVIDER || 'r2').toLowerCase();
    this.providers = {
      cloudinary: cloudinaryProvider,
      googleDrive: googleDriveProvider,
      r2: r2Provider
    };
  }

  getProvider(providerName = null) {
    const name = (providerName || this.defaultProvider).toLowerCase();
    const provider = this.providers[name];
    if (!provider) throw new Error(`Storage provider '${name}' not found.`);
    return provider;
  }

  /**
   * Upload media. Strictly enforces R2 as only primary write provider.
   * Cloudinary new writes are completely blocked.
   */
  async upload({ data, folder = 'ekdujekeliye', filename = null, provider = null }) {
    const targetProviderName = (provider || this.defaultProvider).toLowerCase();

    // Guard: Prevent any new writes to Cloudinary
    if (targetProviderName === 'cloudinary' && env.MEDIA_WRITE_PROVIDER === 'r2') {
      throw new Error(
        '[CRITICAL STORAGE GUARD] New writes to Cloudinary are strictly blocked. MEDIA_WRITE_PROVIDER=r2. Cloudinary is read-only fallback only.'
      );
    }

    const selectedProvider = this.getProvider(targetProviderName);
    return await selectedProvider.upload({ data, folder, filename });
  }

  async delete(fileId, provider = null) {
    const selectedProvider = this.getProvider(provider);
    return await selectedProvider.delete(fileId);
  }
}

export const storageService = new StorageService();
