import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { env } from '../src/config/env.js';

async function updateProgramPrices() {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB Atlas.');

  // 1. All completed/archived/past programs -> ₹1000
  await Event.updateMany(
    {
      $or: [
        { status: { $in: ['completed', 'archived'] } },
        { date: { $lt: '2026-09-01' } },
        { id: 'prog-1785924307713' }
      ]
    },
    { $set: { price: 1000 } }
  );

  // 2. All upcoming/future programs -> ₹1500
  await Event.updateMany(
    {
      status: { $in: ['upcoming', 'few_seats', 'housefull'] },
      date: { $gte: '2026-09-01' }
    },
    { $set: { price: 1500 } }
  );

  // 3. Print verified pricing table
  const allEvents = await Event.find().sort({ date: 1 }).lean();
  console.log('\n--- VERIFIED PROGRAM PRICING TABLE ---');
  allEvents.forEach(p => {
    console.log('ID:', p.id.padEnd(25), 'Date:', (p.date || '').padEnd(12), 'Status:', (p.status || '').padEnd(12), 'Price: ₹' + p.price);
  });

  await mongoose.disconnect();
}

updateProgramPrices();
