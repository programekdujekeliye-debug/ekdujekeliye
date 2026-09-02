import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';

async function auditAndConfigureEvents(dbName) {
  let uri = env.MONGO_URI;
  if (dbName) {
    uri = uri.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
  }

  console.log(`\n========================================================`);
  console.log(`Auditing & Configuring Events in: ${dbName || 'DEFAULT DB'}`);
  console.log(`========================================================`);

  const conn = await mongoose.createConnection(uri).asPromise();
  const EventModel = conn.model('Event', Event.schema, 'program');

  const targetEvents = await EventModel.find({
    $or: [
      { id: { $in: ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-12'] } },
      { slug: { $in: ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-12', 'ek06', 'ek07'] } },
      { sequenceNumber: { $in: [6, 7] } }
    ]
  }).lean();

  console.log(`Found ${targetEvents.length} target event records:`);
  for (const ev of targetEvents) {
    console.log({
      _id: ev._id,
      id: ev.id,
      sequenceNumber: ev.sequenceNumber,
      name: ev.name,
      date: ev.date,
      time: ev.time,
      venue: ev.venue,
      isPaymentEnabled: ev.isPaymentEnabled,
      communicationsEnabled: ev.communicationsEnabled,
      passReminderEnabled: ev.passReminderEnabled,
      personalizedInvitationEnabled: ev.personalizedInvitationEnabled
    });
  }

  // Update EK06 and EK07 to ensure personalizedInvitationEnabled: true
  const updateRes = await EventModel.updateMany(
    {
      $or: [
        { id: { $in: ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-12'] } },
        { sequenceNumber: { $in: [6, 7] } }
      ]
    },
    {
      $set: {
        personalizedInvitationEnabled: true,
        passReminderEnabled: true,
        communicationsEnabled: true
      }
    }
  );

  console.log(`\nUpdate Result for ${dbName || 'DEFAULT DB'}:`, {
    matchedCount: updateRes.matchedCount,
    modifiedCount: updateRes.modifiedCount,
    acknowledged: updateRes.acknowledged
  });

  // Verify updated records
  const verifiedEvents = await EventModel.find({
    $or: [
      { id: { $in: ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-12'] } },
      { sequenceNumber: { $in: [6, 7] } }
    ]
  }).lean();

  console.log(`\nVerified updated records:`);
  for (const ev of verifiedEvents) {
    console.log(`[VERIFIED] Event: ${ev.id} (${ev.name}) -> personalizedInvitationEnabled: ${ev.personalizedInvitationEnabled}`);
  }

  await conn.close();
}

async function run() {
  try {
    // 1. Audit & Configure Test DB
    await auditAndConfigureEvents('ekdujekeliye_test');

    // 2. Audit & Configure Production DB
    await auditAndConfigureEvents('ekdujekeliye');

    console.log('\nAll event audits and configurations completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Audit failed:', err);
    process.exit(1);
  }
}

run();
