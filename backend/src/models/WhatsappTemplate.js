import mongoose from 'mongoose';

const WhatsappTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  text: { type: String, required: true },
  type: {
    type: String,
    enum: ['pass_delivery', 'payment_request', 'payment_reminder', 'event_reminder', 'thank_you'],
    default: 'pass_delivery'
  },
  isActive: { type: Boolean, default: false }
}, {
  collection: 'whatsapp_template',
  timestamps: true,
  autoIndex: false
});

export const WhatsappTemplate = mongoose.models.WhatsappTemplate || mongoose.model('WhatsappTemplate', WhatsappTemplateSchema);
