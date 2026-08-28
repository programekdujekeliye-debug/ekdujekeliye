import mongoose from 'mongoose';

const WhatsappMessageSchema = new mongoose.Schema({
  messageId: { type: String, unique: true, index: true },
  eventId: { type: String, index: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', index: true },
  inquiryId: { type: String, index: true },
  recipientPhone: { type: String, required: true },
  templateName: { type: String, required: true },
  languageCode: { type: String, default: 'en' },
  messageType: { type: String, enum: ['payment_confirmation', 'pass_delivery', 'reminder', 'custom'], default: 'payment_confirmation' },
  idempotencyKey: { type: String, unique: true, required: true, index: true },
  status: {
    type: String,
    enum: ['QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
    default: 'QUEUED',
    index: true
  },
  providerMessageId: { type: String, index: true },
  attemptCount: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  lastErrorCode: { type: String },
  lastErrorMessage: { type: String },
  templateParameters: { type: mongoose.Schema.Types.Mixed, default: {} },
  rawProviderResponse: { type: mongoose.Schema.Types.Mixed },
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

export const WhatsappMessage = mongoose.models.WhatsappMessage || mongoose.model('WhatsappMessage', WhatsappMessageSchema);
