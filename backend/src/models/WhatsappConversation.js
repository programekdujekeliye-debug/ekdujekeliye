import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  adminId: { type: String, default: 'admin' },
  adminName: { type: String, default: 'Admin' },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const WhatsappConversationSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  phoneMasked: { type: String },
  phoneHash: { type: String, index: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', index: true, default: null },
  inquiryId: { type: String, index: true, default: null },
  eventId: { type: String, index: true, default: null },
  customerName: { type: String, default: 'WhatsApp Guest' },
  status: {
    type: String,
    enum: ['OPEN', 'CLOSED'],
    default: 'OPEN',
    index: true
  },
  unreadCount: { type: Number, default: 0, index: true },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  lastMessagePreview: { type: String, default: '' },
  lastMessageDirection: {
    type: String,
    enum: ['INBOUND', 'OUTBOUND'],
    default: 'INBOUND'
  },
  lastMessageStatus: { type: String, default: 'RECEIVED' },
  lastInboundAt: { type: Date, default: null },
  lastOutboundAt: { type: Date, default: null },
  customerServiceWindowExpiresAt: { type: Date, default: null, index: true },
  assignedAdminId: { type: String, default: null, index: true },
  assignedAdminName: { type: String, default: null },
  notes: [NoteSchema],
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  collection: 'whatsapp_conversations',
  timestamps: true,
  autoIndex: false
});

// Secondary compound indexes for fast inbox filtering and pagination
WhatsappConversationSchema.index({ status: 1, lastMessageAt: -1 });
WhatsappConversationSchema.index({ unreadCount: 1, lastMessageAt: -1 });
WhatsappConversationSchema.index({ eventId: 1, lastMessageAt: -1 });
WhatsappConversationSchema.index({ assignedAdminId: 1, lastMessageAt: -1 });
WhatsappConversationSchema.index({ customerServiceWindowExpiresAt: 1 });

export const WhatsappConversation = mongoose.models.WhatsappConversation || mongoose.model('WhatsappConversation', WhatsappConversationSchema);
