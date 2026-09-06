import { connectDatabase } from '../src/config/database.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import mongoose from 'mongoose';

const prodUri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function testPerfProd() {
  await mongoose.connect(prodUri, { family: 4 });
  console.log('Testing dashboard endpoint performance on PRODUCTION DB (2,470 registrations)...');

  const t0 = Date.now();
  const eventId = 'prog-2026-09-07';

  const eventObj = await Event.findOne({
    $or: [{ id: eventId }, { slug: eventId }, { date: eventId }]
  }).lean();
  console.log(`Event lookup took: ${Date.now() - t0}ms`);

  const t1 = Date.now();
  const matchedIds = [eventId];
  if (eventObj) {
    if (eventObj.id && !matchedIds.includes(eventObj.id)) matchedIds.push(eventObj.id);
    if (eventObj.slug && !matchedIds.includes(eventObj.slug)) matchedIds.push(eventObj.slug);
  }

  const matchFilter = {
    isDeleted: { $ne: true },
    $or: [
      { programId: { $in: matchedIds } },
      ...(eventObj?.date ? [{ programDate: eventObj.date }] : [])
    ]
  };

  const t2 = Date.now();
  const [stats, recent] = await Promise.all([
    Registration.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          vipTotal: { $sum: { $cond: [{ $eq: ['$isVip', true] }, 1, 0] } },
          vipApproved: { $sum: { $cond: [{ $and: [{ $eq: ['$isVip', true] }, { $eq: ['$status', 'approved'] }] }, 1, 0] } }
        }
      }
    ]),
    Registration.find(matchFilter).sort({ createdAt: -1 }).limit(5).lean()
  ]);

  console.log(`Aggregation + find took: ${Date.now() - t2}ms`);
  console.log('Stats:', stats);
  console.log('Recent count:', recent.length);

  await mongoose.disconnect();
  process.exit(0);
}

testPerfProd().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
