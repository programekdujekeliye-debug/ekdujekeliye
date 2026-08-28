import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Setting } from '../src/models/Setting.js';

async function updateLivePhone() {
  const uri = env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing from environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  const result = await Setting.updateOne(
    { key: 'global' },
    {
      $set: {
        supportPhone: '+91 82003 02328',
        supportWhatsapp: '+91 82003 02328',
        supportEmail: 'privacy.ekdujekeliye@gmail.com'
      }
    },
    { upsert: true }
  );

  console.log('Updated global settings in database:', result);

  const updated = await Setting.findOne({ key: 'global' }).lean();
  console.log('Current Global Setting in DB:', {
    brandName: updated?.brandName,
    businessCategory: updated?.businessCategory,
    supportPhone: updated?.supportPhone,
    supportWhatsapp: updated?.supportWhatsapp,
    supportEmail: updated?.supportEmail
  });

  await mongoose.disconnect();
  console.log('MongoDB disconnected. Done.');
}

updateLivePhone().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
