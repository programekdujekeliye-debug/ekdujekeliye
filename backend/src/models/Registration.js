import mongoose from 'mongoose';

const RegistrationSchema = new mongoose.Schema({
  inquiryId: { type: String, required: true },
  customerToken: { type: String, index: true },
  husbandName: { type: String, required: true },
  wifeName: { type: String, required: true },
  surname: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  whatsappOptIn: { type: Boolean, default: undefined },
  whatsappOptInAt: { type: Date, default: null },
  whatsappConsentSource: { type: String, default: '' },
  whatsappMarketingOptIn: { type: Boolean, default: false },
  whatsappOptOutAt: { type: Date, default: null },
  whatsappOptOutReason: { type: String, default: '' },
  programId: { type: String, required: true },
  programName: { type: String },
  programDate: { type: String },
  programTime: { type: String },
  couplePhoto: { type: String, default: '/sample_couple.png' },
  paymentScreenshot: { type: String, default: null },
  status: {
    type: String,
    enum: ['inquiry', 'pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isVip: { type: Boolean, default: false },
  payment: {
    provider: { type: String, enum: ['razorpay', 'legacy_upi', 'cash', 'free', 'manual_invite', 'manual'], default: 'razorpay' },
    status: { type: String, enum: ['created', 'pending', 'captured', 'failed', 'refunded'], default: 'pending' },
    amount: { type: Number, default: 1500 },
    currency: { type: String, default: 'INR' },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    attempts: { type: Number, default: 0 },
    paidAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
  },
  attendance: { type: mongoose.Schema.Types.Mixed, default: 'unmarked' },
  attendanceAt: { type: Date, default: null },
  attendanceMarkedAt: { type: Date, default: null },
  attendanceMethod: { type: String, default: null },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
  photoZoom: { type: Number, default: 1.0 },
  photoOffsetX: { type: Number, default: 0 },
  photoOffsetY: { type: Number, default: 0 },
  frameExportStatus: {
    type: String,
    enum: ['NOT_EXPORTED', 'EXPORTED', 'MODIFIED'],
    default: 'NOT_EXPORTED',
    index: true
  },
  frameExportedAt: { type: Date, default: null },
  frameExportBatch: { type: Number, default: 0 },
  paymentReminder: {
    count: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: null },
    nextReminderAt: { type: Date, default: null }
  },
  invitationCardUrl: { type: String, default: null },
  invitationHash: { type: String, default: null },
  invitationVersion: { type: Number, default: 1 },
  invitationGeneratedAt: { type: Date, default: null },
  previousInquiryId: { type: String, default: null, index: true },
  transferHistory: [{
    fromProgramId: { type: String },
    toProgramId: { type: String },
    oldInquiryId: { type: String },
    newInquiryId: { type: String },
    transferredAt: { type: Date, default: Date.now },
    reason: { type: String, default: '' }
  }],
  mediaProvider: {
    type: String,
    enum: ['CLOUDINARY', 'R2', 'DRIVE_ARCHIVE', 'FALLBACK'],
    default: 'CLOUDINARY'
  },
  r2Media: {
    status: {
      type: String,
      enum: ['CLOUDINARY_ACTIVE', 'R2_COPYING', 'R2_VERIFIED', 'R2_PRIMARY', 'CLOUDINARY_FALLBACK', 'CLOUDINARY_CLEANUP_READY', 'CLOUDINARY_DELETED', 'MEDIA_UPLOAD_RETRY', 'REJECTED'],
      default: 'CLOUDINARY_ACTIVE'
    },
    bucket: { type: String, default: null },
    key: { type: String, default: null },
    isPrivate: { type: Boolean, default: false },
    thumbKey: { type: String, default: null },
    normalKey: { type: String, default: null },
    largeKey: { type: String, default: null },
    thumbUrl: { type: String, default: null },
    normalUrl: { type: String, default: null },
    largeUrl: { type: String, default: null },
    cloudinaryFallbackUrl: { type: String, default: null },
    verifiedAt: { type: Date, default: null }
  }
}, {
  collection: 'submission',
  timestamps: true,
  autoIndex: false
});

RegistrationSchema.index({ inquiryId: 1 }, { unique: true });
RegistrationSchema.index({ createdAt: -1 });
RegistrationSchema.index({ isDeleted: 1, createdAt: -1 });
RegistrationSchema.index({ isDeleted: 1, isVip: 1, createdAt: -1 });
RegistrationSchema.index({ isDeleted: 1, isVip: 1, programId: 1, createdAt: -1 });
RegistrationSchema.index({ isDeleted: 1, isVip: 1, status: 1, createdAt: -1 });
RegistrationSchema.index({ programId: 1, createdAt: -1 });
RegistrationSchema.index({ programId: 1, status: 1, isDeleted: 1 });
RegistrationSchema.index({ programDate: 1, createdAt: -1 });
RegistrationSchema.index({ isDeleted: 1, programId: 1, createdAt: -1 });
RegistrationSchema.index({ phoneNumber: 1, status: 1 });
RegistrationSchema.index({ phoneNumber: 1, programId: 1, status: 1 });
RegistrationSchema.index({ 'payment.razorpayOrderId': 1 });
RegistrationSchema.index({ 'payment.razorpayPaymentId': 1 });


// Consent Evaluation Helpers
export function hasOperationalWhatsappConsent(registration) {
  if (!registration) return false;
  // If explicitly opted out via STOP / webhook
  if (registration.whatsappOptOutAt) return false;
  // If explicitly opted in
  if (registration.whatsappOptIn === true) return true;
  // If explicitly opted out in form
  if (registration.whatsappOptIn === false) return false;
  // Legacy historical records (undefined): allow operational messages if not opted out
  return true;
}

export function hasMarketingWhatsappConsent(registration) {
  if (!registration) return false;
  if (registration.whatsappOptOutAt) return false;
  // Marketing consent must be strictly explicit true, never inferred or defaulted
  return registration.whatsappMarketingOptIn === true;
}

export const Registration = mongoose.models.Submission || mongoose.model('Submission', RegistrationSchema);
export const Submission = Registration;

