import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'info' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, {
  collection: 'notifications'
});

export const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
