import mongoose from 'mongoose';

const SettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  // Payment & UPI Rotation
  upiId: { type: String, default: '' },
  upiIds: { type: [String], default: [] },
  activeUpiIndex: { type: Number, default: 0 },
  upiBookingsCount: { type: Number, default: 0 },
  upiLimit: { type: Number, default: 50 },
  payeeName: { type: String, default: 'Ek Duje Ke Liye' },
  amount: { type: String, default: '1500' },
  
  // Global Brand & Support Contact Defaults
  brandName: { type: String, default: 'Ek Duje Ke Liye' },
  businessCategory: { type: String, default: 'Education & Training' },
  businessDescription: { type: String, default: 'Relationship Education, Couple Communication, Life Skills Training and Educational Seminars/Workshops' },
  supportPhone: { type: String, default: '+91 82003 02328' },
  supportWhatsapp: { type: String, default: '+91 82003 02328' },
  supportEmail: { type: String, default: '' },
  websiteEmail: { type: String, default: '' },
  
  // Social Links
  instagramUrl: { type: String, default: '' },
  facebookUrl: { type: String, default: '' },
  youtubeUrl: { type: String, default: '' },
  linktreeUrl: { type: String, default: '' },
  
  // Defaults
  defaultCity: { type: String, default: 'Surat' },
  defaultCountry: { type: String, default: 'India' },
  defaultCurrency: { type: String, default: 'INR' },
  defaultPrice: { type: Number, default: 1500 },
  defaultSpeakerName: { type: String, default: 'Manish Vaghasiya' },
  defaultSpeakerTitle: { type: String, default: 'Couple Relationship Counselor & Life Coach' },
  defaultRegistrationInstructions: { type: String, default: '' },
  defaultPassInstructions: { type: String, default: '' },
  defaultFooterCopy: { type: String, default: '' }
}, {
  collection: 'setting',
  timestamps: true,
  autoIndex: false
});

export const Setting = mongoose.models.Setting || mongoose.model('Setting', SettingSchema);
