import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  paymentId: { type: String, required: true, unique: true, index: true },
  orderId: { type: String, index: true },
  inquiryId: { type: String, required: true, index: true },
  eventId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
    default: 'created'
  },
  method: { type: String, default: 'upi' },
  provider: { type: String, enum: ['razorpay', 'manual', 'cash'], default: 'razorpay' },
  rawResponse: { type: Object, default: {} },
  capturedAt: { type: Date }
}, {
  collection: 'payments',
  timestamps: true
});

PaymentSchema.index({ eventId: 1, status: 1 });

export const Payment = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
