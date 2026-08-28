import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';

async function prepareTestEvent() {
  if (env.APP_ENV === 'production' || env.DATABASE_NAME !== 'ekdujekeliye_test') {
    throw new Error('Safety block: Only intended for local test DB');
  }

  await mongoose.connect(env.MONGO_URI);
  console.log('Database:', env.DATABASE_NAME, 'Env:', env.DATABASE_ENV);

  // Check if manual test event already exists
  let event = await Event.findOne({ slug: 'edkl-manual-e2e-test' });
  if (!event) {
    event = await Event.create({
      id: 'prog-manual-e2e-01',
      sequenceNumber: 1,
      name: 'EDKL Manual E2E Test',
      shortName: 'Manual E2E Test',
      slug: 'edkl-manual-e2e-test',
      city: 'Surat',
      venue: 'Sardar Smruti Bhavan, Surat',
      venueAddress: 'Varachha Main Road, Surat, Gujarat 395006',
      description: 'Official test seminar for EDKL manual end-to-end rehearsal.',
      price: 1500,
      status: 'upcoming',
      date: '2026-09-20',
      time: '8:30 PM',
      capacity: 50,
      bookedSeats: 0,
      isDateFinal: true,
      isInquiryClosed: false,
      registrationMode: 'internal',
      isActive: true
    });
    console.log('✓ Created Manual Test Event in TEST DB:', event.name, `(${event.slug})`);
  } else {
    console.log('✓ Found existing Manual Test Event in TEST DB:', event.name, `(${event.slug})`);
  }

  const allEvents = await Event.find({ status: { $ne: 'archived' } }).lean();
  console.log('\n--- Active Events in DB ---');
  allEvents.forEach((e, idx) => {
    console.log(` [${idx + 1}] ID: ${e.id} | Slug: ${e.slug} | Name: ${e.name} | Date: ${e.date} | Status: ${e.status}`);
  });

  await mongoose.disconnect();
}

prepareTestEvent().catch(console.error);
