import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';
import { Counter } from '../src/models/Counter.js';
import { Event } from '../src/models/Event.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { Pass } from '../src/models/Pass.js';

const PROGRAM_NAME = 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan';
const VENUE_NAME = 'Sardar Patel Smruti Bhavan, Varachha, Surat';
const MAP_URL = 'https://share.google/y1jtFAZXuKusYTiUD';

async function migrate() {
  const targetUri = process.env.TARGET_MONGO_URI || env.MONGO_URI;
  console.log('Connecting to database:', targetUri.replace(/:([^:@]+)@/, ':****@'));
  await mongoose.connect(targetUri);

  console.log('\n--- 1. UPDATING 7 SEPTEMBER & 11 SEPTEMBER EVENTS ---');
  await Event.findOneAndUpdate(
    { date: '2026-09-07' },
    {
      $set: {
        id: 'prog-2026-09-07',
        sequenceNumber: 6,
        name: PROGRAM_NAME,
        slug: 'surat-7-september-2026',
        city: 'Surat',
        venue: VENUE_NAME,
        mapUrl: MAP_URL,
        price: 1500,
        status: 'upcoming',
        isInquiryClosed: false,
        isRegistrationOpen: true,
        isPaymentEnabled: false,
        earlyRegistrationMode: true,
        paymentOpenedAt: null,
        paymentOpeningNote: 'Online payment will open shortly. Payment link will be sent on your registered WhatsApp number.',
        isDateFinal: true,
        capacity: 1184,
        time: '8:30 PM'
      }
    },
    { upsert: true, returnDocument: 'after' }
  );

  await Event.findOneAndUpdate(
    { date: '2026-09-11' },
    {
      $set: {
        id: 'prog-2026-09-11',
        sequenceNumber: 7,
        name: PROGRAM_NAME,
        slug: 'surat-11-september-2026',
        city: 'Surat',
        venue: VENUE_NAME,
        mapUrl: MAP_URL,
        price: 1500,
        status: 'upcoming',
        isInquiryClosed: false,
        isRegistrationOpen: true,
        isPaymentEnabled: false,
        earlyRegistrationMode: true,
        paymentOpenedAt: null,
        paymentOpeningNote: 'Online payment will open shortly. Payment link will be sent on your registered WhatsApp number.',
        isDateFinal: true,
        capacity: 1184,
        time: '8:30 PM'
      }
    },
    { upsert: true, returnDocument: 'after' }
  );
  console.log('✅ 7 Sep (seq 6) and 11 Sep (seq 7) events configured.');

  console.log('\n--- 2. RENAMING ALL EK01-* REGISTRATIONS TO EK06-* ---');
  const ek01Regs = await Registration.find({
    $or: [
      { inquiryId: { $regex: '^EK01-' } },
      { phoneNumber: { $in: ['9974446563', '9909150367'] } }
    ]
  });

  console.log(`Found ${ek01Regs.length} registrations to migrate.`);
  for (const reg of ek01Regs) {
    const oldId = reg.inquiryId;
    let newId = oldId;
    if (oldId.startsWith('EK01-')) {
      newId = oldId.replace('EK01-', 'EK06-');
    } else if (reg.phoneNumber === '9974446563') {
      newId = 'EK06-05';
    } else if (reg.phoneNumber === '9909150367') {
      newId = 'EK06-06';
    }

    await Registration.updateOne(
      { _id: reg._id },
      {
        $set: {
          inquiryId: newId,
          programId: 'prog-2026-09-07',
          programDate: '2026-09-07',
          programName: PROGRAM_NAME,
          isDeleted: false
        }
      }
    );

    // Also update Pass and WhatsappMessage if existing
    await Pass.updateMany({ inquiryId: oldId }, { $set: { inquiryId: newId } });
    await WhatsappMessage.updateMany({ inquiryId: oldId }, { $set: { inquiryId: newId, eventId: 'prog-2026-09-07' } });

    console.log(`  ✓ Migrated: ${oldId} -> ${newId} (${reg.husbandName} & ${reg.wifeName} ${reg.surname})`);
  }

  console.log('\n--- 3. MAPPING ALL EK06 REGISTRATIONS TO 7 SEPTEMBER 2026 ---');
  const res = await Registration.updateMany(
    { inquiryId: { $regex: '^EK06-' } },
    {
      $set: {
        programId: 'prog-2026-09-07',
        programDate: '2026-09-07',
        programName: PROGRAM_NAME,
        isDeleted: false
      }
    }
  );
  console.log(`  ✓ Updated ${res.modifiedCount} EK06 registrations.`);

  console.log('\n--- 4. SYNCHRONIZING COUNTERS ---');
  const allEk06 = await Registration.find({ inquiryId: { $regex: '^EK06-' } }).lean();
  let maxSeq = 0;
  for (const r of allEk06) {
    const m = r.inquiryId.match(/^EK06-(\d+)/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > maxSeq) maxSeq = num;
    }
  }
  console.log(`Highest existing EK06 sequence: ${maxSeq}`);
  if (maxSeq > 0) {
    await Counter.findOneAndUpdate(
      { $or: [{ _id: 'inquiryNumber_prog-2026-09-07' }, { name: 'inquiryNumber_prog-2026-09-07' }] },
      { $max: { seq: maxSeq }, $set: { name: 'inquiryNumber_prog-2026-09-07' } },
      { upsert: true }
    );
    console.log(`  ✓ Counter inquiryNumber_prog-2026-09-07 updated to ${maxSeq}`);
  }

  console.log('\n--- 5. VERIFYING ALL 7 SEPTEMBER REGISTRATIONS ---');
  const finalRegs = await Registration.find({
    $or: [
      { programId: 'prog-2026-09-07' },
      { programId: 'surat-7-september-2026' },
      { programDate: '2026-09-07' },
      { inquiryId: { $regex: '^EK06-' } }
    ]
  }).sort({ inquiryId: 1 }).lean();

  console.log(`Total registrations found for 7 September 2026: ${finalRegs.length}`);
  finalRegs.forEach(r => {
    console.log(`  - [${r.inquiryId}] ${r.husbandName} & ${r.wifeName} ${r.surname} (${r.phoneNumber}) - Status: ${r.status}, Payment: ${r.payment?.status}`);
  });

  console.log('\n🎉 Migration completed successfully.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
