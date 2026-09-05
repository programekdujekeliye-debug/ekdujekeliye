import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';
import { Registration } from '../src/models/Registration.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const reg379 = await Registration.findOne({ inquiryId: /379/i }).lean();
  console.log('--- REG 379 ---');
  console.log(JSON.stringify(reg379, null, 2));

  if (reg379) {
    const msgs = await WhatsappMessage.find({
      $or: [{ inquiryId: reg379.inquiryId }, { registrationId: reg379._id }]
    }).lean();
    console.log('--- MSGS FOR 379 (Count:', msgs.length, ') ---');
    console.log(JSON.stringify(msgs, null, 2));
  }

  const failedMsgs = await WhatsappMessage.find({ status: { $in: ['FAILED', 'BLOCKED_TEST_MODE'] } })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();
  console.log('--- RECENT FAILED/BLOCKED (Limit 3) ---');
  console.log(JSON.stringify(failedMsgs, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
