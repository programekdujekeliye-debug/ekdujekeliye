import '../src/config/env.js';
import mongoose from 'mongoose';
import { sendUtilityTemplate } from '../src/integrations/whatsapp/whatsapp.service.js';
import { ensureFeedbackToken } from '../src/modules/feedback/feedback.controller.js';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';

const PROD_URI = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
const uri = process.env.PROD_MONGO_URI || PROD_URI;

async function run() {
  await mongoose.connect(uri);

  const testPhone = '918320594829';
  const event = await Event.findOne({
    $or: [{ id: 'prog-2026-09-07' }, { date: '2026-09-07' }]
  }).lean();

  console.log(`Event found: ${event?.name} | Photo link: ${event?.photoLink}`);

  // Find a test attendee or EK06-03
  let reg = await Registration.findOne({ inquiryId: 'EK06-03' });
  if (!reg) {
    reg = await Registration.findOne({ programId: 'prog-2026-09-07', status: 'approved' });
  }

  const customerName = `${reg?.husbandName || 'Jaynesh'} & ${reg?.wifeName || 'Pooja'}`.trim();
  const feedback = await ensureFeedbackToken(reg.inquiryId, event.id || event.slug, customerName);

  console.log(`Sending test post-event message to ${testPhone}...`);
  console.log({
    customerName,
    eventName: event.name,
    registrationId: reg.inquiryId,
    galleryToken: reg.inquiryId,
    feedbackToken: feedback.token
  });

  const sendResult = await sendUtilityTemplate({
    recipientPhone: testPhone,
    templateKey: 'edkl_post_event_memories_feedback_v1',
    languageCode: 'en_US',
    variables: {
      customerName,
      eventName: event.name || 'Ek Duje Ke Liye Seminar',
      registrationId: reg.inquiryId,
      galleryToken: reg.inquiryId,
      feedbackToken: feedback.token
    },
    idempotencyKey: `TEST_POST_EVENT:${reg.inquiryId}:${Date.now()}`,
    registrationId: reg._id,
    eventId: event.id || event.slug,
    inquiryId: reg.inquiryId,
    trigger: 'post_event_test_dispatch',
    providerMode: 'META'
  });

  console.log('Result:', JSON.stringify(sendResult, null, 2));
  await mongoose.disconnect();
}

run().catch(console.error);
