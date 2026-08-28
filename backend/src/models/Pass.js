import mongoose from 'mongoose';

const PassSchema = new mongoose.Schema({
  passId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  eventId: {
    type: String,
    required: true,
    index: true
  },
  registrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: true,
    index: true
  },
  inquiryId: {
    type: String,
    required: true,
    index: true
  },
  version: {
    type: Number,
    default: 1
  },
  qrVersion: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'USED', 'REVOKED', 'CANCELLED'],
    default: 'ACTIVE',
    index: true
  },
  qrToken: {
    type: String
  },
  keyId: {
    type: String,
    default: 'edkl-k1'
  },
  firstScannedAt: {
    type: Date,
    default: null
  },
  firstScannedBy: {
    deviceId: { type: String },
    operatorUserId: { type: String },
    mode: { type: String, enum: ['ONLINE', 'OFFLINE_SYNC'] }
  },
  lastScannedAt: {
    type: Date,
    default: null
  },
  scanCount: {
    type: Number,
    default: 0
  },
  revocationReason: {
    type: String
  },
  issuedAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'passes',
  timestamps: true,
  autoIndex: false
});

PassSchema.index({ eventId: 1, registrationId: 1 }, { unique: true });
PassSchema.index({ eventId: 1, inquiryId: 1 });
PassSchema.index({ eventId: 1, status: 1 });

export const Pass = mongoose.models.Pass || mongoose.model('Pass', PassSchema);
