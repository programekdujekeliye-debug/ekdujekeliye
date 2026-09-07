import mongoose from 'mongoose';

const VipLinkSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    default: "Today's VIP Entry Link"
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  programId: {
    type: String,
    required: true,
    default: 'prog-2026-09-07',
    index: true
  },
  programName: {
    type: String,
    default: 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan'
  },
  programDate: {
    type: String,
    default: '2026-09-07'
  },
  maxSeats: {
    type: Number,
    default: 0 // 0 = unlimited, >0 = strict capacity
  },
  usedSeats: {
    type: Number,
    default: 0 // total submissions via this link
  },
  approvedSeats: {
    type: Number,
    default: 0 // approved VIP passes via this link
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'HOUSEFULL', 'CLOSED'],
    default: 'HOUSEFULL',
    index: true
  },
  isDefault: {
    type: Boolean,
    default: false,
    index: true
  },
  notes: {
    type: String,
    default: ''
  },
  createdBy: {
    type: String,
    default: 'system'
  }
}, {
  collection: 'vip_links',
  timestamps: true
});

export const VipLink = mongoose.models.VipLink || mongoose.model('VipLink', VipLinkSchema);
export default VipLink;
