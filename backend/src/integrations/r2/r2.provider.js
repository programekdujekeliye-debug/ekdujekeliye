import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import https from 'https';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { env } from '../../config/env.js';

export class R2StorageProvider {
  constructor() {
    this.enabled = env.R2_ENABLED;
    this.publicBucket = env.R2_PUBLIC_BUCKET || 'edkl-public-media';
    this.privateBucket = env.R2_PRIVATE_BUCKET || 'edkl-private-media';
    this.publicBaseUrl = (env.R2_PUBLIC_BASE_URL || 'https://media.ekdujekeliye.in').replace(/\/$/, '');

    if (this.enabled) {
      const httpsAgent = new https.Agent({
        keepAlive: true,
        maxSockets: 64,
        timeout: 60000
      });

      this.client = new S3Client({
        region: 'auto',
        endpoint: env.R2_ENDPOINT,
        forcePathStyle: true,
        requestHandler: new NodeHttpHandler({
          httpsAgent,
          connectionTimeout: 5000,
          requestTimeout: 20000
        }),
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY
        }
      });
    } else {
      this.client = null;
    }
  }

  ensureClient() {
    if (!this.client) {
      throw new Error('[R2 ERROR] Cloudflare R2 is not configured. Missing R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY.');
    }
  }

  /**
   * Test connectivity and list buckets
   */
  async listBuckets() {
    this.ensureClient();
    const command = new ListBucketsCommand({});
    const response = await this.client.send(command);
    return response.Buckets || [];
  }

  /**
   * Create bucket if it does not exist
   */
  async createBucketIfNotExists(bucketName) {
    this.ensureClient();
    try {
      const command = new CreateBucketCommand({ Bucket: bucketName });
      await this.client.send(command);
      return { success: true, created: true, bucketName };
    } catch (err) {
      if (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists') {
        return { success: true, created: false, bucketName, message: 'Bucket already exists' };
      }
      throw err;
    }
  }

  /**
   * Generic upload compatible with StorageService interface
   * @param {Object} params - { data, folder, filename, bucket, contentType }
   */
  async upload({ data, folder = 'ekdujekeliye', filename = null, bucket = null, contentType = null }) {
    if (!data) return null;
    if (typeof data === 'string' && (data.startsWith('http://') || data.startsWith('https://'))) {
      return data;
    }

    let buffer;
    let mimeType = contentType || 'image/jpeg';
    let ext = 'jpg';

    if (Buffer.isBuffer(data)) {
      buffer = data;
    } else if (typeof data === 'string' && data.startsWith('data:')) {
      const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
        if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
      } else {
        throw new Error('Invalid data URI format');
      }
    } else {
      throw new Error('Unsupported data format for R2 upload');
    }

    const name = filename || `file_${Date.now()}`;
    const cleanName = name.endsWith(`.${ext}`) ? name : `${name}.${ext}`;
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    const key = `${cleanFolder}/${cleanName}`;

    const res = await this.putObject({
      bucket: bucket || this.publicBucket,
      key,
      body: buffer,
      contentType: mimeType
    });

    return res.publicUrl;
  }

  /**
   * Direct Buffer / Stream upload to R2
   */
  async putObject({ bucket, key, body, contentType = 'application/octet-stream', cacheControl = null }) {
    this.ensureClient();
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    const command = new PutObjectCommand({
      Bucket: bucket || this.publicBucket,
      Key: cleanKey,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl || 'public, max-age=31536000, immutable'
    });

    await this.client.send(command);
    return {
      success: true,
      bucket: bucket || this.publicBucket,
      key: cleanKey,
      publicUrl: `${this.publicBaseUrl}/${cleanKey}`
    };
  }

  /**
   * Verify an object exists in R2 and return metadata
   */
  async headObject({ bucket, key }) {
    this.ensureClient();
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket || this.publicBucket,
        Key: cleanKey
      });
      const res = await this.client.send(command);
      return {
        exists: true,
        contentLength: res.ContentLength,
        contentType: res.ContentType,
        lastModified: res.LastModified,
        etag: res.ETag
      };
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return { exists: false };
      }
      throw err;
    }
  }

  /**
   * Delete an object from R2
   */
  async deleteObject({ bucket, key }) {
    this.ensureClient();
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    const command = new DeleteObjectCommand({
      Bucket: bucket || this.publicBucket,
      Key: cleanKey
    });
    await this.client.send(command);
    return { success: true, key: cleanKey };
  }

  /**
   * Generate short-lived presigned PUT URL for direct browser uploads
   */
  async generatePresignedUploadUrl({ bucket, key, contentType, expiresIn = 300 }) {
    this.ensureClient();
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    const targetBucket = bucket || this.publicBucket;

    const command = new PutObjectCommand({
      Bucket: targetBucket,
      Key: cleanKey,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable'
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    return {
      uploadUrl,
      bucket: targetBucket,
      key: cleanKey,
      publicUrl: targetBucket === this.publicBucket ? `${this.publicBaseUrl}/${cleanKey}` : null,
      expiresIn
    };
  }

  /**
   * Generate short-lived presigned GET URL for private downloads (e.g. payment proofs)
   */
  async generatePresignedDownloadUrl({ bucket, key, expiresIn = 300 }) {
    this.ensureClient();
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    const targetBucket = bucket || this.privateBucket;

    const command = new GetObjectCommand({
      Bucket: targetBucket,
      Key: cleanKey
    });

    const downloadUrl = await getSignedUrl(this.client, command, { expiresIn });
    return {
      downloadUrl,
      bucket: targetBucket,
      key: cleanKey,
      expiresIn
    };
  }

  /**
   * Stream / Copy Cloudinary source URL to R2 object
   */
  async copyCloudinaryToR2({ cloudinaryUrl, targetBucket, targetKey, contentType = 'image/jpeg' }) {
    this.ensureClient();
    if (!cloudinaryUrl || !cloudinaryUrl.startsWith('http')) {
      throw new Error(`Invalid Cloudinary URL: ${cloudinaryUrl}`);
    }

    const response = await fetch(cloudinaryUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Cloudinary original: HTTP ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const resolvedContentType = response.headers.get('content-type') || contentType;

    return await this.putObject({
      bucket: targetBucket || this.publicBucket,
      key: targetKey,
      body: buffer,
      contentType: resolvedContentType,
      cacheControl: 'public, max-age=31536000, immutable'
    });
  }

  /**
   * Fetch object buffer from R2
   */
  async getObjectBuffer({ bucket, key }) {
    this.ensureClient();
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    const command = new GetObjectCommand({
      Bucket: bucket || this.privateBucket,
      Key: cleanKey
    });

    const response = await this.client.send(command);
    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  /**
   * Server-side Copy object between R2 buckets or keys
   */
  async copyObject({ sourceBucket, sourceKey, targetBucket, targetKey, contentType = null }) {
    this.ensureClient();
    const cleanSourceKey = sourceKey.startsWith('/') ? sourceKey.substring(1) : sourceKey;
    const cleanTargetKey = targetKey.startsWith('/') ? targetKey.substring(1) : targetKey;
    const fromBucket = sourceBucket || this.publicBucket;
    const toBucket = targetBucket || this.privateBucket;

    try {
      const copyCommand = new CopyObjectCommand({
        Bucket: toBucket,
        Key: cleanTargetKey,
        CopySource: encodeURIComponent(`${fromBucket}/${cleanSourceKey}`)
      });
      await this.client.send(copyCommand);
      return { success: true, bucket: toBucket, key: cleanTargetKey };
    } catch (copyErr) {
      // Fallback to get + put stream if S3 CopyObject fails across bucket boundaries
      const buf = await this.getObjectBuffer({ bucket: fromBucket, key: cleanSourceKey });
      const head = await this.headObject({ bucket: fromBucket, key: cleanSourceKey });
      await this.putObject({
        bucket: toBucket,
        key: cleanTargetKey,
        body: buf,
        contentType: contentType || head.contentType || 'image/jpeg',
        cacheControl: toBucket === this.publicBucket ? 'public, max-age=31536000, immutable' : 'private, no-cache'
      });
      return { success: true, bucket: toBucket, key: cleanTargetKey };
    }
  }

  /**
   * Format standard public CDN URL
   */
  getPublicUrl(key) {
    const cleanKey = key.startsWith('/') ? key.substring(1) : key;
    return `${this.publicBaseUrl}/${cleanKey}`;
  }
}

export const r2Provider = new R2StorageProvider();
