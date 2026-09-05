import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const failedCount = await WhatsappMessage.countDocuments({ status: 'FAILED' });
  const blockedCount = await WhatsappMessage.countDocuments({ status: 'BLOCKED_TEST_MODE' });
  console.log('FAILED count:', failedCount, 'BLOCKED_TEST_MODE count:', blockedCount);

  const failedMsgs = await WhatsappMessage.find({ status: { $in: ['FAILED', 'BLOCKED_TEST_MODE'] } })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  console.log('\nRecent Failed/Blocked Messages:');
  failedMsgs.forEach(m => {
    console.log({
      inquiryId: m.inquiryId,
      phone: m.recipientPhone,
      template: m.templateName,
      status: m.status,
      trigger: m.trigger,
      providerMode: m.providerMode,
      lastErrorMessage: m.lastErrorMessage,
      lastErrorCode: m.lastErrorCode,
      createdAt: m.createdAt
    });
  });

  const reg379 = await Registration.findOne({ inquiryId: /379/i }).lean();
  console.log('\nRegistration 379:');
  if (reg379) {
    console.log({
      id: reg379._id,
      inquiryId: reg379.inquiryId,
      name: `${reg379.husbandName} & ${reg379.wifeName}`,
      phone: reg379.phoneNumber,
      programId: reg379.programId,
      status: reg379.status,
      payment: reg379.payment,
      createdAt: reg379.createdAt
    });

    const msgs379 = await WhatsappMessage.find({
      $or: [{ registrationId: reg379._id }, { inquiryId: reg379.inquiryId }]
    }).lean();
    console.log('Messages for 379:', msgs379.length);
    msgs379.forEach(m => {
      console.log({
        template: m.templateName,
        status: m.status,
        trigger: m.trigger,
        error: m.lastErrorMessage,
        errorCode: m.lastErrorCode,
        providerMode: m.providerMode
      });
    });
  } else {
    console.log('No reg found matching 379');
  }

  const events = await Event.find({}).select('id slug name date status price isPaymentEnabled earlyRegistrationMode').lean();
  console.log('\nEvents:', events);

  await mongoose.disconnect();
}

run().catch(console.error);
