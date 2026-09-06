import mongoose from 'mongoose';

const UploadSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  version: { type: Number, default: 1 },
  purpose: {
    type: String,
    enum: ['couple_photo', 'payment_proof', 'invitation_card', 'gallery'],
    required: true
  },
  eventId: { type: String, required: true, index: true },
  registrationSessionId: { type: String, required: true, index: true },
  mediaType: { type: String, required: true },
  nonce: { type: String, required: true, unique: true },
  declaredFileSize: { type: Number, required: true },
  declaredContentType: { type: String, required: true },
  declaredFileName: { type: String, default: '' },
  bucket: { type: String, required: true },
  objectKey: { type: String, required: true },
  opaqueMediaId: { type: String, required: true },
  status: {
    type: String,
    enum: ['CREATED', 'URL_ISSUED', 'UPLOADED', 'VERIFIED', 'CONSUMED', 'REJECTED', 'EXPIRED'],
    default: 'CREATED',
    index: true
  },
  actualFileSize: { type: Number, default: null },
  actualContentType: { type: String, default: null },
  consumedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: true }
}, {
  collection: 'upload_sessions',
  timestamps: true,
  autoIndex: false
});

// Auto-expire documents after expiresAt passes
UploadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UploadSession = mongoose.models.UploadSession || mongoose.model('UploadSession', UploadSessionSchema);
