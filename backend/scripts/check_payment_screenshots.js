import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';

const PROD_MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(PROD_MONGO_URI);

  const upcomingEvents = ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-19'];

  const upcomingPayments = await Registration.countDocuments({
    programId: { $in: upcomingEvents },
    paymentScreenshot: { $exists: true, $ne: null, $ne: '' }
  });

  const pastPayments = await Registration.countDocuments({
    programId: { $nin: upcomingEvents },
    paymentScreenshot: { $exists: true, $ne: null, $ne: '' }
  });

  console.log(`Upcoming registrations with paymentScreenshot: ${upcomingPayments}`);
  console.log(`Past registrations with paymentScreenshot: ${pastPayments}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
