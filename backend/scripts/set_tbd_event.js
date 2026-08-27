import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { env } from '../src/config/env.js';

async function setTbdEvent() {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const res = await Event.findOneAndUpdate(
    { id: 'prog-1785924307713' },
    {
      $set: {
        name: 'Ek Duje Ke Liye (Date To Be Announced)',
        date: 'TBD',
        isDateFinal: false,
        status: 'date_tba',
        price: 1500,
        isInquiryClosed: false,
        slug: 'ek-duje-ke-liye-date-tba'
      }
    },
    { new: true }
  );

  console.log('✅ Updated TBD Event successfully:');
  console.log('- ID:', res?.id);
  console.log('- Date:', res?.date, '(isDateFinal:', res?.isDateFinal, ')');
  console.log('- Status:', res?.status);
  console.log('- Price: ₹' + res?.price);

  await mongoose.disconnect();
}

setTbdEvent();
