import mongoose from 'mongoose';

const BackupRecordSchema = new mongoose.Schema({
  backupId: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'manual', 'event_final'],
    default: 'daily',
    index: true
  },
  eventId: { type: String, default: null, index: true },
  status: {
    type: String,
    enum: ['pending', 'created', 'verified', 'failed'],
    default: 'pending',
    index: true
  },
  size: { type: Number, default: 0 },
  checksum: { type: String, default: '' },
  driveFileId: { type: String, default: null },
  driveManifestFileId: { type: String, default: null },
  manifest: { type: mongoose.Schema.Types.Mixed, default: {} },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  lastError: { type: String, default: null }
}, {
  collection: 'backup_records',
  timestamps: true
});

BackupRecordSchema.index({ type: 1, createdAt: -1 });
BackupRecordSchema.index({ status: 1, createdAt: -1 });

export const BackupRecord = mongoose.models.BackupRecord || mongoose.model('BackupRecord', BackupRecordSchema);
