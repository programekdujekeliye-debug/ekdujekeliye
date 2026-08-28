import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['payment_reminder', 'event_reminder', 'thank_you', 'database_backup', 'archive_event']
  },
  eventId: { type: String, index: true },
  registrationId: { type: String, index: true },
  runAt: { type: Date, required: true, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  lastError: { type: String },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  completedAt: { type: Date }
}, {
  collection: 'jobs',
  timestamps: true,
  autoIndex: false
});

JobSchema.index({ status: 1, runAt: 1 });

export const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);
