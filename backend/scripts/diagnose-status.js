import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { mediaService } from '../src/modules/media/media.service.js';
import { eventService } from '../src/modules/events/event.service.js';

async function diagnose() {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connected to MongoDB');

  const t0 = Date.now();
  const submission = await Registration.findOne({
    $or: [
      { inquiryId: 'EK06-02' },
      { inquiryId: 'EK06-02' }
    ],
    isDeleted: { $ne: true }
  }).lean();
  console.log('1. Registration.findOne took:', Date.now() - t0, 'ms', submission?.husbandName);

  const t1 = Date.now();
  const program = await eventService.getEventBySlug(submission.programId);
  console.log('2. eventService.getEventBySlug took:', Date.now() - t1, 'ms', program?.name);

  const t2 = Date.now();
  const archive = await MediaArchive.findOne({ registrationId: submission.inquiryId }).lean();
  console.log('3. MediaArchive.findOne took:', Date.now() - t2, 'ms', archive ? 'found' : 'not found');

  const t3 = Date.now();
  const mediaState = await mediaService.resolveRegistrationMedia(submission);
  console.log('4. mediaService.resolveRegistrationMedia took:', Date.now() - t3, 'ms');

  await mongoose.disconnect();
}

diagnose().catch(console.error);
