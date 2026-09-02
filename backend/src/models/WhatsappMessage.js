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
  RECEIVED: 'RECEIVED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED'
};

const WhatsappMessageSchema = new mongoose.Schema({
  messageId: { type: String, unique: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsappConversation', index: true },
  direction: {
    type: String,
    enum: ['INBOUND', 'OUTBOUND'],
    default: 'OUTBOUND',
    index: true
  },
  eventId: { type: String, index: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', index: true },
  paymentId: { type: String, index: true },
  passId: { type: String, index: true },
  inquiryId: { type: String, index: true },
  recipientPhone: { type: String, required: true },
  recipientMasked: { type: String },
  recipientHash: { type: String, index: true },
  senderPhone: { type: String },
  senderMasked: { type: String },
  content: { type: String, default: '' },
  contentType: {
    type: String,
    enum: ['text', 'image', 'document', 'audio', 'video', 'location', 'interactive', 'template', 'button', 'note'],
    default: 'template'
  },
  mediaId: { type: String },
  mediaUrl: { type: String },
  mediaMimeType: { type: String },
  mediaCaption: { type: String },
  replyToMessageId: { type: String },
  readByAdminAt: { type: Date, default: null },
  sentByAdminId: { type: String, default: null },
  sentByAdminName: { type: String, default: null },
  isInternalNote: { type: Boolean, default: false },
  templateName: { type: String, default: null },
  templateLanguage: { type: String, default: 'en_US' },
  templateCategory: { type: String, enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION', 'SERVICE'], default: 'UTILITY' },
  messageType: {
    type: String,
    default: 'custom'
  },
  trigger: { type: String, default: 'manual', index: true },
  executionSource: {
    type: String,
    enum: ['NORMAL', 'MANUAL_TEST', 'AUTOMATED_TEST', 'ADMIN_REPLY', 'INBOUND_WEBHOOK', 'MANUAL_ADMIN'],
    default: 'NORMAL',
    index: true
  },
  providerMode: {
    type: String,
    enum: ['META', 'MOCK'],
    default: 'META',
    index: true
  },
  idempotencyKey: { type: String, required: true },
  status: {
    type: String,
    enum: Object.values(WHATSAPP_MESSAGE_STATUSES),
    default: WHATSAPP_MESSAGE_STATUSES.QUEUED,
    index: true
  },
  providerMessageId: { type: String },
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
  receivedAt: { type: Date },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
  failedAt: { type: Date }
}, {
  collection: 'whatsapp_messages',
  timestamps: true,
  autoIndex: false
});

WhatsappMessageSchema.index({ conversationId: 1, createdAt: 1 });
WhatsappMessageSchema.index({ status: 1, createdAt: 1 });
WhatsappMessageSchema.index({ idempotencyKey: 1 }, { unique: true });
WhatsappMessageSchema.index({ providerMessageId: 1 }, { sparse: true });
WhatsappMessageSchema.index({ eventId: 1, status: 1 });
WhatsappMessageSchema.index({ eventId: 1, messageType: 1, status: 1 });
WhatsappMessageSchema.index({ registrationId: 1, createdAt: 1 });
WhatsappMessageSchema.index({ inquiryId: 1, createdAt: 1 });
WhatsappMessageSchema.index({ scheduledFor: 1, status: 1 });

export const WhatsappMessage = mongoose.models.WhatsappMessage || mongoose.model('WhatsappMessage', WhatsappMessageSchema);
