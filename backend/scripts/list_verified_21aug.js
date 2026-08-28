import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { Registration } from '../src/models/Registration.js';
import { env } from '../src/config/env.js';

async function listVerified21Aug() {
  await mongoose.connect(env.MONGO_URI);

  const eventId = 'prog-1786621655629';
  const verifiedList = await MediaArchive.find({ eventId, status: { $in: ['VERIFIED', 'ARCHIVED'] } })
    .sort({ verifiedAt: 1 })
    .lean();

  console.log(`=== 21 AUG VERIFIED RECORDS (${verifiedList.length}) ===`);
  verifiedList.forEach((v, i) => {
    console.log(`${i + 1}. [${v.registrationId}] DriveFileId: ${v.driveFileId} | File: ${v.filename} | VerifiedAt: ${v.verifiedAt}`);
  });

  await mongoose.disconnect();
}

listVerified21Aug();
