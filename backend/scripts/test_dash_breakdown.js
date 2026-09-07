import { env } from '../src/config/env.js';
import mongoose from 'mongoose';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { Registration } from '../src/models/Registration.js';

async function main() {
  await mongoose.connect(env.PROD_MONGO_URI);
  
  const eventIds = ['prog-2026-09-07', '6a90570d055ee8341adb46c5', 'surat-7-september-2026', '2026-09-07'];
  
  const breakdown = await WhatsappMessage.aggregate([
    { $match: { eventId: { $in: eventIds } } },
    {
      $group: {
        _id: { messageType: '$messageType', status: '$status' },
        count: { $sum: 1 }
      }
    }
  ]);

  console.log('Breakdown for event:');
  console.log(JSON.stringify(breakdown, null, 2));

  process.exit(0);
}

main().catch(console.error);
