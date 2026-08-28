import mongoose from 'mongoose';

const WhatsappTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  language: { type: String, default: 'en_US' },
  category: { type: String, enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION'], default: 'UTILITY' },
  text: { type: String, default: '' },
  type: {
    type: String,
    enum: ['pass_delivery', 'payment_request', 'payment_reminder', 'event_reminder', 'thank_you', 'custom'],
    default: 'pass_delivery'
  },
  providerTemplateId: { type: String },
  status: {
    type: String,
    enum: ['NOT_CREATED', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'],
    default: 'NOT_CREATED'
  },
  rejectionReason: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  lastSyncedAt: { type: Date, default: Date.now }
}, {
  collection: 'whatsapp_template',
  timestamps: true,
  autoIndex: false
});

WhatsappTemplateSchema.index({ name: 1, language: 1 }, { unique: true });

export const WhatsappTemplate = mongoose.models.WhatsappTemplate || mongoose.model('WhatsappTemplate', WhatsappTemplateSchema);
