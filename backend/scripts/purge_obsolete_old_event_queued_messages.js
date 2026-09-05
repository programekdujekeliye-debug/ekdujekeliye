import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

// Maintenance script: Purge/cancel obsolete queued messages linked to 7 September that belong to legacy event prefixes
const LEGACY_PREFIXES = ['CPL', 'EK05', 'IP', 'EK03', 'EK01', 'EK02', 'EK04'];

async function run() {
  const isProd = process.argv.includes('--prod');
  let mongoUri = process.env.MONGO_URI || env.MONGO_URI;
  if (isProd) {
    mongoUri = "mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority";
  }
  console.log(`Connecting to MongoDB (${isProd ? 'PRODUCTION ekdujekeliye' : 'CONFIGURED'} database)...`);
  const conn = await mongoose.connect(mongoUri);
  const db = conn.connection.db;

  console.log(`Connected to database: ${conn.connection.name}`);

  // 1. Find all QUEUED messages under prog-2026-09-07 with legacy prefixes
  const regexPattern = new RegExp(`^(${LEGACY_PREFIXES.join('|')})-`, 'i');

  const obsoleteMessages = await db.collection('whatsapp_messages').find({
    status: 'QUEUED',
    inquiryId: { $regex: regexPattern }
  }).project({ _id: 1, inquiryId: 1, eventId: 1, trigger: 1 }).toArray();

  console.log(`Found ${obsoleteMessages.length} obsolete queued messages matching legacy prefixes (${LEGACY_PREFIXES.join(', ')}).`);

  if (obsoleteMessages.length > 0) {
    const updateResult = await db.collection('whatsapp_messages').updateMany(
      {
        status: 'QUEUED',
        inquiryId: { $regex: regexPattern }
      },
      {
        $set: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          lastErrorMessage: 'Cancelled: Legacy event inquiry prefix excluded from active seminar automation.',
          cancellationReason: 'LEGACY_EVENT_EXCLUDED'
        }
      }
    );

    console.log(`Successfully cancelled ${updateResult.modifiedCount} obsolete queued messages!`);
  } else {
    console.log('No obsolete queued messages to purge.');
  }

  // 2. Verify remaining queue for prog-2026-09-07, prog-2026-09-11, prog-2026-09-19
  const remainingQueued = await db.collection('whatsapp_messages').aggregate([
    { $match: { status: 'QUEUED' } },
    { $group: { _id: { eventId: "$eventId", trigger: "$trigger" }, count: { $sum: 1 } } }
  ]).toArray();

  console.log('\n--- REMAINING CLEAN QUEUED SUMMARY ---');
  console.log(remainingQueued);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => {
  console.error('Error running purge script:', err);
  process.exit(1);
});
