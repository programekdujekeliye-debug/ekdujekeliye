import { cloudinaryProvider } from '../integrations/cloudinary/cloudinary.provider.js';
import { googleDriveProvider } from '../integrations/google-drive/google-drive.provider.js';

export class StorageService {
  constructor(defaultProvider = 'cloudinary') {
    this.defaultProvider = defaultProvider;
    this.providers = {
      cloudinary: cloudinaryProvider,
      googleDrive: googleDriveProvider
    };
  }

  getProvider(providerName = null) {
    const name = providerName || this.defaultProvider;
    const provider = this.providers[name];
    if (!provider) throw new Error(`Storage provider '${name}' not found.`);
    return provider;
  }

  async upload({ data, folder = 'ekdujekeliye', filename = null, provider = null }) {
    const selectedProvider = this.getProvider(provider);
    return await selectedProvider.upload({ data, folder, filename });
  }

  async delete(fileId, provider = null) {
    const selectedProvider = this.getProvider(provider);
    return await selectedProvider.delete(fileId);
  }
}

export const storageService = new StorageService();
