import mongoose from 'mongoose';

const WebhookEventSchema = new mongoose.Schema({
  provider: { type: String, required: true }, // 'razorpay', 'whatsapp'
  eventId: { type: String, required: true },
  eventType: { type: String, required: true },
  processedAt: { type: Date, default: Date.now },
  payloadSummary: { type: mongoose.Schema.Types.Mixed }
}, {
  collection: 'webhook_events',
  timestamps: true,
  autoIndex: false
});

WebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const WebhookEvent = mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', WebhookEventSchema);
