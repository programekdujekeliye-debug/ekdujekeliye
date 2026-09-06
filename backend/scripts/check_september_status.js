import mongoose from 'mongoose';

async function check() {
  await mongoose.connect((process.env.PROD_MONGO_URI || process.env.MONGO_URI));
  const Msg = mongoose.model('WhatsappMessage', new mongoose.Schema({}, { collection: 'whatsapp_messages', strict: false }));
  
  const byStatus = await Msg.aggregate([
    { $match: { eventId: 'prog-2026-09-07' } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  console.log('Current status for prog-2026-09-07:', byStatus);

  const stillFailed = await Msg.countDocuments({ eventId: 'prog-2026-09-07', status: 'FAILED' });
  console.log('Still FAILED count for prog-2026-09-07:', stillFailed);

  const queued = await Msg.countDocuments({ eventId: 'prog-2026-09-07', status: 'QUEUED' });
  console.log('QUEUED count for prog-2026-09-07:', queued);

  process.exit(0);
}

check().catch(console.error);
