import mongoose from 'mongoose';

export const WHATSAPP_MESSAGE_STATUSES = {
  QUEUED: 'QUEUED',
  BLOCKED_TEMPLATE_PENDING: 'BLOCKED_TEMPLATE_PENDING',
  BLOCKED_TEMPLATE_REJECTED: 'BLOCKED_TEMPLATE_REJECTED',
  BLOCKED_TEST_MODE: 'BLOCKED_TEST_MODE',
  SENDING: 'SENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED'
};

const WhatsappMessageSchema = new mongoose.Schema({
  messageId: { type: String, unique: true, index: true },
  eventId: { type: String, index: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', index: true },
  paymentId: { type: String, index: true },
  passId: { type: String, index: true },
  inquiryId: { type: String, index: true },
  recipientPhone: { type: String, required: true },
  recipientMasked: { type: String },
  recipientHash: { type: String, index: true },
  templateName: { type: String, required: true },
  templateLanguage: { type: String, default: 'en_US' },
  templateCategory: { type: String, enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION'], default: 'UTILITY' },
  messageType: {
    type: String,
    enum: [
      'registration_received',
      'payment_pending',
      'payment_confirmation',
      'payment_failed',
      'pass_delivery',
      'invitation',
      'reminder',
      'event_update',
      'event_cancelled',
      'pass_reissued',
      'feedback_request',
      'gallery_ready',
      'custom'
    ],
    default: 'payment_confirmation'
  },
  trigger: { type: String, default: 'manual', index: true },
  executionSource: {
    type: String,
    enum: ['NORMAL', 'MANUAL_TEST', 'AUTOMATED_TEST'],
    default: 'NORMAL',
    index: true
  },
  providerMode: {
    type: String,
    enum: ['META', 'MOCK'],
    default: 'META',
    index: true
  },
  idempotencyKey: { type: String, unique: true, required: true, index: true },
  status: {
    type: String,
    enum: Object.values(WHATSAPP_MESSAGE_STATUSES),
    default: WHATSAPP_MESSAGE_STATUSES.QUEUED,
    index: true
  },
  providerMessageId: { type: String, index: true },
  attemptCount: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  providerErrorCode: { type: String },
  providerErrorMessage: { type: String },
  lastErrorCode: { type: String },
  lastErrorMessage: { type: String },
  lastAttemptAt: { type: Date },
  lockedAt: { type: Date, default: null, index: true },
  scheduledFor: { type: Date, default: null, index: true },
  templateParameters: { type: mongoose.Schema.Types.Mixed, default: {} },
  rawProviderResponse: { type: mongoose.Schema.Types.Mixed },
  providerAcceptedAt: { type: Date },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date }
}, {
  collection: 'whatsapp_messages',
  timestamps: true,
  autoIndex: false
});

WhatsappMessageSchema.index({ status: 1, createdAt: 1 });
WhatsappMessageSchema.index({ idempotencyKey: 1 }, { unique: true });
WhatsappMessageSchema.index({ providerMessageId: 1 }, { sparse: true });
WhatsappMessageSchema.index({ eventId: 1, status: 1 });
WhatsappMessageSchema.index({ eventId: 1, messageType: 1, status: 1 });
WhatsappMessageSchema.index({ registrationId: 1, createdAt: 1 });
WhatsappMessageSchema.index({ inquiryId: 1, createdAt: 1 });
WhatsappMessageSchema.index({ scheduledFor: 1, status: 1 });

export const WhatsappMessage = mongoose.models.WhatsappMessage || mongoose.model('WhatsappMessage', WhatsappMessageSchema);
