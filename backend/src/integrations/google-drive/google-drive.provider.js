/**
 * Google Drive Storage Provider (Interface Skeleton)
 * Prepared for future 5TB storage integration without modifying active business logic.
 */
export class GoogleDriveStorageProvider {
  constructor() {
    this.enabled = false;
  }

  async upload({ data, folder = 'Events', filename = null }) {
    throw new Error('Google Drive integration is not yet active. Using Cloudinary fallback.');
  }

  async delete(fileId) {
    throw new Error('Google Drive integration is not yet active.');
  }

  async getUrl(fileId) {
    throw new Error('Google Drive integration is not yet active.');
  }
}

export const googleDriveProvider = new GoogleDriveStorageProvider();
