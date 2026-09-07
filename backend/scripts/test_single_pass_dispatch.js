import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { sendUtilityTemplate } from '../src/integrations/whatsapp/whatsapp.service.js';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log('Connected to MongoDB');

  // Find EK07-284
  const inqId = 'EK07-284';
  const reg = await Registration.findOne({ inquiryId: inqId }).lean();
  const event = await Event.findOne({ id: 'prog-2026-09-11' }).lean();

  if (!reg || !event) {
    console.error('Registration or Event not found');
    process.exit(1);
  }

  console.log(`Testing dispatch for ${inqId}: ${reg.husbandName} & ${reg.wifeName}, Phone: ${reg.phoneNumber}`);

  const customerName = `${reg.husbandName || ''} & ${reg.wifeName || ''}`.trim() || 'Respected Couple';
  const eventName = event.name || 'Ek Duje Ke Liye Seminar';
  const eventDate = event.date || '2026-09-11';
  const eventTime = event.time || '8:30 PM';
  const venue = event.venue || 'Sardar Patel Smruti Bhavan, Surat';

  const result = await sendUtilityTemplate({
    recipientPhone: reg.phoneNumber,
    templateKey: 'edkl_payment_confirmed_pass_v1',
    languageCode: 'en_US',
    variables: {
      customerName,
      eventName,
      eventDate,
      eventTime,
      venue,
      registrationId: reg.inquiryId,
      inquiryId: reg.inquiryId
    },
    idempotencyKey: `MANUAL_RETRY:${inqId}:${Date.now()}`,
    registrationId: reg._id,
    eventId: event.id,
    inquiryId: reg.inquiryId,
    trigger: 'payment_verified'
  });

  console.log('Result from Meta WhatsApp API:');
  console.log(JSON.stringify(result, null, 2));

  process.exit(0);
}

main().catch(console.error);
