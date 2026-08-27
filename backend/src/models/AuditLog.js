import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  userId: { type: String, default: 'system' },
  role: { type: String, default: 'ADMIN' },
  eventId: { type: String, index: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String },
  userAgent: { type: String }
}, {
  collection: 'audit_logs',
  timestamps: { createdAt: true, updatedAt: false }
});

AuditLogSchema.index({ eventId: 1, createdAt: -1 });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
