import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { env } from '../src/config/env.js';

async function check() {
  await mongoose.connect(env.PROD_MONGO_URI);
  console.log('Connected to:', mongoose.connection.db.databaseName);

  const events = await Event.find({
    sequenceNumber: { $in: [6, 7, 8] }
  }).sort({ sequenceNumber: 1 }).lean();

  for (const ev of events) {
    const total = await Registration.countDocuments({ programId: ev.id, isDeleted: { $ne: true } });
    const withPhoto = await Registration.countDocuments({
      programId: ev.id,
      isDeleted: { $ne: true },
      couplePhoto: { $exists: true, $ne: null, $ne: '', $ne: '/sample_couple.png' }
    });
    const r2Primary = await Registration.countDocuments({
      programId: ev.id,
      isDeleted: { $ne: true },
      'r2Media.status': 'R2_PRIMARY'
    });
    const pending = withPhoto - r2Primary;
    const withPayment = await Registration.countDocuments({
      programId: ev.id,
      isDeleted: { $ne: true },
      paymentScreenshot: { $type: 'string', $nin: ['', null] }
    });
    const withInvitation = await Registration.countDocuments({
      programId: ev.id,
      isDeleted: { $ne: true },
      invitationCardUrl: { $type: 'string', $nin: ['', null] }
    });
    console.log(`EK0${ev.sequenceNumber} ("${ev.name}"): Total=${total}, WithPhoto=${withPhoto}, R2_Primary=${r2Primary}, Pending=${pending}, WithPayment=${withPayment}, WithInvitation=${withInvitation}`);
    if (withInvitation > 0) {
      const sample = await Registration.findOne({ programId: ev.id, isDeleted: { $ne: true }, invitationCardUrl: { $type: 'string', $nin: ['', null] } }).lean();
      console.log(`  Sample invitationCardUrl: ${sample?.invitationCardUrl}`);
    }
  }
  await mongoose.disconnect();
}
check();
