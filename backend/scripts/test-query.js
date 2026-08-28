import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';
import { eventService } from '../src/modules/events/event.service.js';

async function test() {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to DB');

  const start1 = Date.now();
  const ev1 = await Event.findOne({ slug: 'surat-7-september-2026' }).lean();
  console.log('Query 1 by slug directly took:', Date.now() - start1, 'ms', ev1?.name);

  const start2 = Date.now();
  const ev2 = await eventService.getEventBySlug('surat-7-september-2026');
  console.log('Query 2 via eventService.getEventBySlug took:', Date.now() - start2, 'ms', ev2?.name);

  await mongoose.disconnect();
}

test().catch(console.error);
