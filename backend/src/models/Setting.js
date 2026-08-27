import mongoose from 'mongoose';

const SettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  upiId: { type: String, default: '' },
  upiIds: { type: [String], default: [] },
  activeUpiIndex: { type: Number, default: 0 },
  upiBookingsCount: { type: Number, default: 0 },
  upiLimit: { type: Number, default: 50 },
  payeeName: { type: String, default: 'Ek Duje Ke Liye' },
  amount: { type: String, default: '1500' }
}, {
  collection: 'setting',
  timestamps: true
});

export const Setting = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);
