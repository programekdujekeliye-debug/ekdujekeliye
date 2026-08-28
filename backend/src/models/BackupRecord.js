import mongoose from 'mongoose';

const BackupRecordSchema = new mongoose.Schema({
  backupId: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'manual', 'event_final'],
    default: 'daily',
    index: true
  },
  scheduled: { type: Boolean, default: false, index: true },
  periodKey: { type: String, default: null, index: true },
  eventId: { type: String, default: null, index: true },
  status: {
    type: String,
    enum: ['pending', 'creating', 'created', 'syncing', 'verified', 'sync_failed', 'failed'],
    default: 'pending',
    index: true
  },
  size: { type: Number, default: 0 },
  checksum: { type: String, default: '' },
  driveFileId: { type: String, default: null },
  driveManifestFileId: { type: String, default: null },
  driveFolderId: { type: String, default: null },
  driveVerifiedAt: { type: Date, default: null },
  manifest: { type: mongoose.Schema.Types.Mixed, default: {} },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  lastError: { type: String, default: null }
}, {
  collection: 'backup_records',
  timestamps: true,
  autoIndex: false
});

BackupRecordSchema.index({ type: 1, createdAt: -1 });
BackupRecordSchema.index({ status: 1, createdAt: -1 });
// Partial unique index to enforce deterministic idempotency for scheduled period backups
BackupRecordSchema.index(
  { type: 1, periodKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      scheduled: true,
      periodKey: { $type: 'string' }
    }
  }
);

export const BackupRecord = mongoose.models.BackupRecord || mongoose.model('BackupRecord', BackupRecordSchema);
