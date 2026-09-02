import mongoose from 'mongoose';
import { env } from './src/config/env.js';
import { Registration } from './src/models/Registration.js';
import { Event } from './src/models/Event.js';
import { registrationService } from './src/modules/registrations/registration.service.js';

async function checkEK06() {
  await mongoose.connect(env.MONGO_URI);
  console.log('--- Checking Database for EK06-233 and 7 Sept Event ---');

  const reg = await Registration.findOne({ inquiryId: /EK06-233/i }).lean();
  console.log('Registration EK06-233:', JSON.stringify(reg, null, 2));

  const allEvents = await Event.find().lean();
  console.log('\n--- All Events in DB ---');
  allEvents.forEach(e => {
    console.log(`Event ID: ${e.id} | Name: ${e.name} | Date: ${e.date} | cardTemplateUrl: ${e.cardTemplateUrl} | cardTemplate: ${e.cardTemplate} | isPaymentEnabled: ${e.isPaymentEnabled}`);
  });

  if (reg) {
    const status = await registrationService.getStatus(reg.inquiryId);
    console.log('\n--- Status payload returned for EK06-233 ---', JSON.stringify(status, null, 2));
  }

  await mongoose.disconnect();
}

checkEK06().catch(console.error);
