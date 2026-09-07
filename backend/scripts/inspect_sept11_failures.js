import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log('Connected to MongoDB\n');

  // 1. Inspect 20 failed Payment Confirmed passes for 2026-09-11
  const sept11Failed = await WhatsappMessage.find({
    eventId: 'prog-2026-09-11',
    status: 'FAILED',
    templateName: 'edkl_payment_confirmed_pass_v1'
  }).lean();

  console.log(`=== Failed Payment Confirmed Passes for Sept 11 (prog-2026-09-11): ${sept11Failed.length} ===`);
  for (const m of sept11Failed) {
    const newerSuccess = await WhatsappMessage.findOne({
      _id: { $ne: m._id },
      inquiryId: m.inquiryId,
      templateName: m.templateName,
      status: { $in: ['SENT', 'DELIVERED', 'READ'] }
    }).lean();

    console.log({
      inquiryId: m.inquiryId,
      phone: m.recipientPhone,
      code: m.lastErrorCode,
      error: m.lastErrorMessage,
      attemptCount: m.attemptCount,
      supersededBy: newerSuccess ? `${newerSuccess._id} (${newerSuccess.status})` : 'NONE'
    });
  }

  // 2. Inspect 3 missing for Sept 11
  console.log(`\n=== 3 Missing Payment Confirmations for Sept 11 ===`);
  for (const inq of ['EK07-316', 'EK07-305', 'EK07-IP-01']) {
    const reg = await Registration.findOne({ inquiryId: inq }).lean();
    console.log({
      inquiryId: inq,
      status: reg?.status,
      paymentStatus: reg?.payment?.status,
      phone: reg?.phoneNumber,
      invitationCardUrl: reg?.invitationCardUrl
    });
  }

  // 3. Find registration with legacy media.ekdujekeliye.in URL
  const legacyRegs = await Registration.find({
    programId: 'prog-2026-09-11',
    $or: [
      { couplePhoto: { $regex: 'media.ekdujekeliye.in' } },
      { invitationCardUrl: { $regex: 'media.ekdujekeliye.in' } }
    ]
  }).lean();
  console.log(`\n=== Sept 11 Registrations with legacy media URLs: ${legacyRegs.length} ===`);
  for (const r of legacyRegs) {
    console.log({
      inquiryId: r.inquiryId,
      couplePhoto: r.couplePhoto,
      invitationCardUrl: r.invitationCardUrl
    });
  }

  // 4. Failed message for Sept 19
  const sept19Failed = await WhatsappMessage.find({
    eventId: 'prog-2026-09-19',
    status: 'FAILED'
  }).lean();
  console.log(`\n=== Sept 19 Failed Messages: ${sept19Failed.length} ===`);
  for (const m of sept19Failed) {
    console.log({
      inquiryId: m.inquiryId,
      template: m.templateName,
      phone: m.recipientPhone,
      code: m.lastErrorCode,
      error: m.lastErrorMessage
    });
  }

  process.exit(0);
}

main().catch(console.error);
