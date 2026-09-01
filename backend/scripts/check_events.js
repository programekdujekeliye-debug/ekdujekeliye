import { connectDatabase } from '../src/config/database.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import mongoose from 'mongoose';

async function inspect() {
  await connectDatabase();
  
  const events = await Event.find({}).lean();
  console.log('--- ALL EVENTS IN DB ---');
  events.forEach(e => {
    console.log(`ID: "${e.id}" | Slug: "${e.slug}" | Date: "${e.date}" | Name: "${e.name}" | Capacity: ${e.capacity} | Status: "${e.status}"`);
  });

  const regCounts = await Registration.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $group: {
        _id: { programId: '$programId', programDate: '$programDate', status: '$status' },
        count: { $sum: 1 }
      }
    }
  ]);
  console.log('--- REGISTRATIONS BREAKDOWN ---');
  console.log(JSON.stringify(regCounts, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

inspect();
