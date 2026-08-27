# Storage Strategy & Provider Abstraction

## 1. Context & Motivation

* **Current Storage**: Cloudinary (Free tier: 25 monthly credits / ~25GB bandwidth & storage).
* **Future Capacity**: 5TB Google Drive / Dedicated Cloud Storage for historical event archives and couple photos.
* **Goal**: Abstract storage operations behind a unified `StorageService` interface so the application never calls third-party SDKs directly inside controllers.

---

## 2. Storage Provider Interface

```javascript
class StorageProvider {
  /**
   * Upload binary buffer or base64 data
   * @param {Object} params - { data, folder, filename, mimeType }
   * @returns {Promise<{ url: string, provider: string, fileId: string }>}
   */
  async upload(params) { throw new Error('Not implemented'); }

  /**
   * Retrieve direct secure URL for a file
   * @param {string} fileId
   * @returns {Promise<string>}
   */
  async getUrl(fileId) { throw new Error('Not implemented'); }

  /**
   * Delete file from storage
   * @param {string} fileId
   * @returns {Promise<boolean>}
   */
  async delete(fileId) { throw new Error('Not implemented'); }
}
```

---

## 3. Active Provider & Phased Roadmap

* **Phase 1 (Active)**: `CloudinaryStorageProvider` wraps current Cloudinary SDK logic for `couplePhotos` and `paymentScreenshots`.
* **Phase 2 (Foundation Ready)**: `GoogleDriveStorageProvider` interface skeleton defined with stream piping and chunked upload capabilities.
* **Phase 3 (Migration)**: Background job moves older completed event photos from Cloudinary into event-specific Google Drive folders (`/EkDujeKeLiye/Events/{EventSlug}/CouplePhotos/`), updating database URLs without client disruption.
