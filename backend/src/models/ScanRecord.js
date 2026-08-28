import mongoose from 'mongoose';

const ScanRecordSchema = new mongoose.Schema({
  scanId: { type: String, unique: true, required: true, index: true },
  eventId: { type: String, required: true, index: true },
  passId: { type: String, index: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', index: true },
  inquiryId: { type: String, index: true },
  deviceId: { type: String, required: true, index: true },
  operatorUserId: { type: String, default: 'admin' },
  mode: {
    type: String,
    enum: ['ONLINE', 'OFFLINE_SYNC'],
    required: true,
    index: true
  },
  result: {
    type: String,
    enum: ['ACCEPTED', 'DUPLICATE', 'WRONG_EVENT', 'INVALID_SIGNATURE', 'REVOKED', 'CONFLICT', 'UNKNOWN_PASS'],
    required: true,
    index: true
  },
  scanLocalId: { type: String },
  deviceSequence: { type: Number, default: 1 },
  scannedAtDevice: { type: Date, default: Date.now },
  receivedAtServer: { type: Date, default: Date.now }
}, {
  collection: 'scan_records',
  timestamps: true,
  autoIndex: false
});

ScanRecordSchema.index({ eventId: 1, createdAt: -1 });
ScanRecordSchema.index({ deviceId: 1, scanLocalId: 1 });
ScanRecordSchema.index({ eventId: 1, passId: 1 });

export const ScanRecord = mongoose.models.ScanRecord || mongoose.model('ScanRecord', ScanRecordSchema);
