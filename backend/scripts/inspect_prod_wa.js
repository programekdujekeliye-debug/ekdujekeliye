import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function run() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log(`Connected to production database: ${mongoose.connection.name}`);

  const counts = await WhatsappMessage.aggregate([
    {
      $group: {
        _id: {
          status: '$status',
          trigger: '$trigger',
          templateName: '$templateName',
          lastErrorCode: '$lastErrorCode',
          lastErrorMessage: '$lastErrorMessage'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  console.log('Current Production WhatsApp Messages Breakdown:');
  for (const c of counts.slice(0, 20)) {
    console.log(`[${c.count}] Status: ${c._id.status} | Trigger: ${c._id.trigger} | Template: ${c._id.templateName} | Code: ${c._id.lastErrorCode} | Err: ${c._id.lastErrorMessage}`);
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
