import { paymentService } from './payment.service.js';
import { Registration } from '../../models/Registration.js';
import { Event } from '../../models/Event.js';
import { verifyWebhookSignature, getRazorpayKeyId } from '../../integrations/razorpay/razorpay.service.js';

export const createOrder = async (req, res) => {
  const { inquiryId } = req.body;
  if (!inquiryId) return res.status(400).json({ error: 'Inquiry ID is required.' });

  try {
    const result = await paymentService.createOrder({ inquiryId });
    res.json({
      success: true,
      keyId: getRazorpayKeyId(),
      ...result
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Server error creating Razorpay order.' });
  }
};

export const verifyPayment = async (req, res) => {
  const { inquiryId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!inquiryId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment signature verification parameters.' });
  }

  try {
    const submission = await paymentService.verifyPayment({
      inquiryId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    res.json({
      success: true,
      message: 'Payment verified successfully and registration confirmed.',
      inquiryId: submission.inquiryId,
      status: submission.status
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Payment verification failed.' });
  }
};

export const handleRazorpayWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody;

  if (!signature || !rawBody) {
    return res.status(400).json({ error: 'Missing signature or payload.' });
  }

  const isValid = verifyWebhookSignature({ rawBody, signature });
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  res.status(200).json({ status: 'ok' });

  try {
    const event = req.body;
    const eventId = req.headers['x-razorpay-event-id'] || `rzp_evt_${Date.now()}`;

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity || {};
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const amount = paymentEntity.amount;
      const inquiryId = paymentEntity.notes?.inquiryId;

      await paymentService.finalizeWebhookPayment({
        eventId,
        orderId,
        paymentId,
        amount,
        inquiryId,
        rawPayload: paymentEntity
      });
    }
  } catch (err) {
    console.error('[Razorpay Webhook] Processing error:', err);
  }
};

export const getPaymentStatus = async (req, res) => {
  const { inquiryId } = req.params;
  try {
    const submission = await Registration.findOne({ inquiryId, isDeleted: { $ne: true } }).lean();
    if (!submission) return res.status(404).json({ error: 'Registration not found.' });

    const program = await Event.findOne({ id: submission.programId }).lean();
    res.json({
      inquiryId: submission.inquiryId,
      status: submission.status,
      payment: submission.payment || {},
      amount: submission.payment?.amount || program?.price || 1500,
      price: submission.payment?.amount || program?.price || 1500,
      programName: program?.name || submission.programName,
      programDate: program?.date || submission.programDate,
      programTime: program?.time || submission.programTime,
      venue: program?.venue || '',
      husbandName: submission.husbandName,
      wifeName: submission.wifeName,
      phoneNumber: submission.phoneNumber,
      isPaid: submission.payment?.status === 'captured' || submission.status === 'approved'
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching payment status.' });
  }
};
