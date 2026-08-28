import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';

async function seedLocalEvents() {
  console.log('====================================================');
  console.log('SEEDING ACTIVE EVENTS IN LOCAL TEST DATABASE');
  console.log('====================================================');
  console.log(`APP_ENV: ${env.APP_ENV}`);
  console.log(`Target Database: ${env.DATABASE_NAME}`);

  if (env.APP_ENV !== 'development' || env.DATABASE_NAME !== 'ekdujekeliye_test') {
    throw new Error(`[SAFETY GUARD] Cannot seed events into non-test DB: ${env.DATABASE_NAME}`);
  }

  await mongoose.connect(env.MONGO_URI);

  const eventsToSeed = [
    {
      id: 'prog-1786622570507',
      sequenceNumber: 1,
      name: 'Ek Duje Ke Liye - Surat Mega Seminar',
      shortName: 'Surat Seminar',
      slug: 'surat-mega-seminar-sept-2026',
      city: 'Surat',
      venue: 'Sardar Smruti Bhavan, Varachha Road, Surat',
      venueAddress: 'Near Mini Bazar, Varachha Road, Surat, Gujarat 395006',
      date: '2026-09-15',
      time: '8:30 PM',
      price: 1500,
      currency: 'INR',
      capacity: 500,
      bookingsCount: 0,
      status: 'upcoming',
      featured: true,
      headline: 'A Transformative Couple & Relationship Enrichment Seminar',
      subheadline: 'Join hundreds of couples for an evening of connection, communication, and emotional growth.',
      description: 'Ek Duje Ke Liye is a premier relationship seminar conducted by experienced life mentors and relationship coaches. Designed to empower couples with actionable tools for deep understanding, conflict resolution, and lasting marital harmony.',
      highlights: [
        'Interactive Couple Communication Exercises',
        'Psychology of Lasting Marital Harmony',
        'Personalized Couple Entry Pass with QR Code',
        'Complimentary Refreshments & Couple Gift Kit'
      ],
      instructions: 'Please arrive 30 minutes prior to showtime for seamless digital pass scanning at the gate.',
      heroImage: '/sample_couple.png',
      posterImage: '/sample_couple.png',
      contactPhone: '9825100000',
      contactWhatsapp: '918320594829',
      contactEmail: 'contact@ekdujekeliye.in',
      speakerName: 'Dr. Manish Vaghasiya',
      speakerTitle: 'Lead Relationship Mentor & Life Coach',
      ctaLabel: 'Register Couple Pass (₹1500)',
      passTitle: 'Official Couple Admission Pass',
      passInstructions: 'Present this digital pass or printed QR code at the entrance gate for entry check-in.',
      isActive: true,
      isInquiryClosed: false,
      isDateFinal: true
    },
    {
      id: 'prog-1786621655629',
      sequenceNumber: 2,
      name: 'Ek Duje Ke Liye - Ahmedabad Special Session',
      shortName: 'Ahmedabad Seminar',
      slug: 'ahmedabad-special-session-sept-2026',
      city: 'Ahmedabad',
      venue: 'Tagore Memorial Hall, Paldi, Ahmedabad',
      venueAddress: 'Paldi Cross Roads, Ahmedabad, Gujarat 380007',
      date: '2026-09-22',
      time: '8:30 PM',
      price: 1500,
      currency: 'INR',
      capacity: 400,
      bookingsCount: 0,
      status: 'upcoming',
      featured: false,
      headline: 'Strengthen Your Bond & Emotional Connection',
      subheadline: 'Exclusive evening session for couples in Ahmedabad.',
      description: 'An insightful and heartwarming session focused on modern marital challenges and building resilient relationships.',
      highlights: [
        'Practical Conflict Resolution Frameworks',
        'Effective Emotional Expression & Listening',
        'Digital QR Pass Gate Check-in'
      ],
      instructions: 'Gate entry begins at 8:00 PM.',
      heroImage: '/sample_couple.png',
      posterImage: '/sample_couple.png',
      contactPhone: '9825100000',
      contactWhatsapp: '918320594829',
      contactEmail: 'contact@ekdujekeliye.in',
      ctaLabel: 'Register Couple Pass (₹1500)',
      passTitle: 'Official Couple Admission Pass',
      passInstructions: 'Present this digital pass at the entry gate.',
      isActive: true,
      isInquiryClosed: false,
      isDateFinal: true
    },
    {
      id: 'prog-1785566789678',
      sequenceNumber: 3,
      name: 'Ek Duje Ke Liye - Rajkot Grand Seminar',
      shortName: 'Rajkot Seminar',
      slug: 'rajkot-grand-seminar-oct-2026',
      city: 'Rajkot',
      venue: 'Hemut Gadhvi Hall, Tagore Road, Rajkot',
      venueAddress: 'Tagore Road, Rajkot, Gujarat 360001',
      date: '2026-10-10',
      time: '8:30 PM',
      price: 1500,
      currency: 'INR',
      capacity: 450,
      bookingsCount: 0,
      status: 'upcoming',
      featured: false,
      headline: 'Celebrating Love, Trust & Togetherness',
      subheadline: 'Special Grand Seminar for Saurashtra couples.',
      description: 'Discover practical wisdom for nurturing lifelong love and emotional partnership.',
      highlights: [
        'Interactive Q&A Session',
        'Couple Engagement Activities',
        'Official Digital Pass with Asymmetric QR'
      ],
      instructions: 'Please bring your digital QR pass on your mobile.',
      heroImage: '/sample_couple.png',
      posterImage: '/sample_couple.png',
      contactPhone: '9825100000',
      contactWhatsapp: '918320594829',
      contactEmail: 'contact@ekdujekeliye.in',
      ctaLabel: 'Register Couple Pass (₹1500)',
      passTitle: 'Official Couple Admission Pass',
      passInstructions: 'Present this digital pass at the entry gate.',
      isActive: true,
      isInquiryClosed: false,
      isDateFinal: true
    }
  ];

  for (const ev of eventsToSeed) {
    await Event.findOneAndUpdate(
      { id: ev.id },
      { $set: ev },
      { upsert: true, returnDocument: 'after' }
    );
    console.log(`✓ Seeded Event: [${ev.id}] ${ev.name} | ${ev.city} | ₹${ev.price} | Date: ${ev.date}`);
  }

  const count = await Event.countDocuments({});
  console.log(`\n✅ Successfully seeded ${count} active events into local test database (${env.DATABASE_NAME}).`);
  await mongoose.disconnect();
}

seedLocalEvents().catch(err => {
  console.error('Error seeding local events:', err);
  process.exit(1);
});
