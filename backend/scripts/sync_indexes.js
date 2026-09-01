import { connectDatabase } from '../src/config/database.js';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';
import mongoose from 'mongoose';

async function syncIndexes() {
  await connectDatabase();
  console.log('Syncing indexes on MongoDB Atlas collections...');

  await Promise.all([
    Registration.syncIndexes(),
    Event.syncIndexes()
  ]);

  const regIndexes = await Registration.collection.indexes();
  console.log('Registration collection active indexes:');
  regIndexes.forEach(idx => console.log(`  - ${idx.name}:`, JSON.stringify(idx.key)));

  const eventIndexes = await Event.collection.indexes();
  console.log('\nEvent collection active indexes:');
  eventIndexes.forEach(idx => console.log(`  - ${idx.name}:`, JSON.stringify(idx.key)));

  await mongoose.disconnect();
  console.log('\nAll indexes synchronized successfully.');
  process.exit(0);
}

syncIndexes().catch(err => {
  console.error('Error syncing indexes:', err);
  process.exit(1);
});
