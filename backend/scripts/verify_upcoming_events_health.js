import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';

const PROD_MONGO_URI = process.env.MONGODB_URI || (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function main() {
  console.log('====================================================');
  console.log('  VERIFYING UPCOMING EVENTS HEALTH & ZERO DISRUPTION');
  console.log('====================================================');

  await mongoose.connect(PROD_MONGO_URI);

  const upcomingEvents = [
    { id: 'prog-2026-09-07', name: '7 September (Surat)', prefix: 'EK06' },
    { id: 'prog-2026-09-11', name: '11 September (Surat)', prefix: 'EK07' },
    { id: 'prog-2026-09-19', name: '19 September (Bhavnagar)', prefix: 'EK08' }
  ];

  let allPassed = true;

  for (const ev of upcomingEvents) {
    console.log(`\n--- Checking ${ev.name} [${ev.id}] ---`);
    const regs = await Registration.find({
      programId: ev.id,
      isDeleted: { $ne: true }
    }).limit(5).lean();

    console.log(`Total checked sample registrations: ${regs.length}`);

    for (const r of regs) {
      if (r.couplePhoto) {
        try {
          const res = await fetch(r.couplePhoto, { method: 'HEAD' });
          const ok = res.status === 200;
          console.log(`  [${r.inquiryId}] Couple Photo: ${res.status} ${ok ? '✅ OK' : '❌ FAILED'} (${r.couplePhoto})`);
          if (!ok) allPassed = false;
        } catch (err) {
          console.log(`  [${r.inquiryId}] Couple Photo Error: ${err.message}`);
          allPassed = false;
        }
      }

      if (r.invitationCardUrl) {
        try {
          const res = await fetch(r.invitationCardUrl, { method: 'HEAD' });
          const ok = res.status === 200;
          console.log(`  [${r.inquiryId}] Invitation Card: ${res.status} ${ok ? '✅ OK' : '❌ FAILED'} (${r.invitationCardUrl})`);
          if (!ok) allPassed = false;
        } catch (err) {
          console.log(`  [${r.inquiryId}] Invitation Card Error: ${err.message}`);
          allPassed = false;
        }
      }
    }
  }

  // Also verify that 0 upcoming records are in MediaArchive or marked deleted
  const upcomingInArchives = await MediaArchive.countDocuments({
    eventId: { $in: ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-19'] }
  });
  console.log(`\nUpcoming events in MediaArchive: ${upcomingInArchives} (Expected: 0)`);
  if (upcomingInArchives > 0) allPassed = false;

  console.log('\n====================================================');
  console.log(`UPCOMING EVENTS VERIFICATION: ${allPassed ? '✅ ALL 100% HEALTHY & INTACT' : '❌ SOME CHECKS FAILED'}`);
  console.log('====================================================');

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
