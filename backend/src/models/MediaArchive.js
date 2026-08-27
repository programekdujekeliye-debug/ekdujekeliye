import mongoose from 'mongoose';

const MediaArchiveSchema = new mongoose.Schema({
  eventId: { type: String, required: true, index: true },
  registrationId: { type: String, default: null, index: true },
  mediaType: {
    type: String,
    enum: ['couple_photo', 'gallery', 'pass', 'report', 'export', 'system'],
    default: 'couple_photo'
  },
  sourceProvider: {
    type: String,
    enum: ['cloudinary', 'local', 'external'],
    default: 'cloudinary'
  },
  sourcePublicId: { type: String, required: true, unique: true },
  sourceUrl: { type: String, required: true },

  destinationProvider: {
    type: String,
    enum: ['google_drive'],
    default: 'google_drive'
  },
  driveFileId: { type: String, default: null },
  driveFolderId: { type: String, default: null },
  driveFolderPath: { type: String, default: '' },
  filename: { type: String, required: true },
  mimeType: { type: String, default: 'image/jpeg' },
  originalSize: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['ACTIVE', 'QUEUED', 'COPYING', 'COPIED', 'VERIFIED', 'DELETE_PENDING', 'ARCHIVED', 'FAILED'],
    default: 'QUEUED',
    index: true
  },

  workerId: { type: String, default: null },
  attempts: { type: Number, default: 0 },
  lastError: { type: String, default: null },

  queuedAt: { type: Date, default: Date.now },
  claimedAt: { type: Date, default: null },
  copiedAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  deleteAfter: { type: Date, default: null },
  archivedAt: { type: Date, default: null },

  retainOperationalCopy: { type: Boolean, default: true }
}, {
  collection: 'media_archives',
  timestamps: true
});

MediaArchiveSchema.index({ status: 1, eventId: 1 });
MediaArchiveSchema.index({ eventId: 1, mediaType: 1 });
MediaArchiveSchema.index({ status: 1, claimedAt: 1 });

export const MediaArchive = mongoose.models.MediaArchive || mongoose.model('MediaArchive', MediaArchiveSchema);
