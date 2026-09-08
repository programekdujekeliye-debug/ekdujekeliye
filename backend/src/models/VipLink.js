import mongoose from 'mongoose';

const VipLinkSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['TITLE_SPONSOR', 'POWERED_BY', 'CO_POWERED_BY', 'SUPPORTED_BY', 'VIP_GUEST', 'CUSTOM'],
    default: 'CUSTOM',
    index: true
  },
  sponsorName: {
    type: String,
    default: '',
    trim: true
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
    index: true
  },
  programName: {
    type: String,
    default: ''
  },
  programDate: {
    type: String,
    default: ''
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
    default: 'ACTIVE',
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
    default: 'admin'
  }
}, {
  collection: 'vip_links',
  timestamps: true
});

VipLinkSchema.index({ programId: 1, status: 1 });

export const VipLink = mongoose.models.VipLink || mongoose.model('VipLink', VipLinkSchema);
export default VipLink;
