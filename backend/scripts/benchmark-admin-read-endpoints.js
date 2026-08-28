import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { Setting } from '../src/models/Setting.js';
import { Payment } from '../src/models/Payment.js';
import { eventService } from '../src/modules/events/event.service.js';

async function runBenchmark() {
  console.log('--- STARTING ADMIN PERFORMANCE BENCHMARK ---');
  await mongoose.connect(env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15000,
    autoIndex: false
  });

  const results = [];

  // Helper to time async execution
  const measure = async (name, fn, iterations = 3) => {
    const times = [];
    let payloadSize = 0;
    let data = null;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      data = await fn();
      const elapsed = performance.now() - start;
      times.push(elapsed);
    }

    if (data) {
      payloadSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
    }

    const cold = times[0];
    const warm = times.length > 1 ? times.slice(1).reduce((a, b) => a + b, 0) / (times.length - 1) : cold;
    const avg = times.reduce((a, b) => a + b, 0) / times.length;

    results.push({
      endpoint: name,
      coldMs: cold.toFixed(2),
      warmMs: warm.toFixed(2),
      avgMs: avg.toFixed(2),
      sizeKb: (payloadSize / 1024).toFixed(2)
    });
  };

  // 1. Event Options (Lightweight selector)
  await measure('Event Options (Select fields only)', async () => {
    return Event.find({}, { id: 1, name: 1, shortName: 1, date: 1, time: 1, status: 1, city: 1, venue: 1 }).lean();
  });

  // 2. Event Service getAdminEvents (Current)
  await measure('Event Slots Summary (eventService.getAdminEvents)', async () => {
    return eventService.getAdminEvents();
  });

  // 3. Submissions First Page (Paginated 50)
  await measure('Registrations First Page (50 items lean + count)', async () => {
    const filter = { isDeleted: { $ne: true } };
    const [items, total] = await Promise.all([
      Registration.find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .select('inquiryId coupleName partner1Name partner2Name phoneNumber city status paymentStatus attendance createdAt programId')
        .lean(),
      Registration.countDocuments(filter)
    ]);
    return { items, total, page: 1, limit: 50 };
  });

  // 4. Operational Admin Dashboard Metrics
  await measure('Admin Dashboard Aggregation', async () => {
    const [counts, nextEvent] = await Promise.all([
      Registration.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$attendance', 'present'] }, 1, 0] } }
          }
        }
      ]),
      Event.findOne({ status: { $in: ['upcoming', 'few_seats'] } }).sort({ date: 1 }).lean()
    ]);
    return { counts, nextEvent };
  });

  // 5. Super Admin Global Dashboard Aggregation
  await measure('Super Admin Dashboard Aggregation', async () => {
    const [regStats, payStats, eventCount] = await Promise.all([
      Registration.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            present: { $sum: { $cond: [{ $eq: ['$attendance', 'present'] }, 1, 0] } }
          }
        }
      ]),
      Payment.aggregate([
        { $match: { status: { $in: ['captured', 'authorized', 'success'] } } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]),
      Event.countDocuments({ status: { $ne: 'archived' } })
    ]);
    return { regStats: regStats[0] || {}, payStats: payStats[0] || {}, eventCount };
  });

  console.log('\n================ BENCHMARK RESULTS ================');
  console.table(results);
  console.log('===================================================\n');

  await mongoose.disconnect();
}

runBenchmark().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
