import mongoose from 'mongoose';

const prodUri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function checkProduction() {
  const conn = await mongoose.createConnection(prodUri).asPromise();
  console.log('Connected to PRODUCTION database: ekdujekeliye');
  
  const Event = conn.model('Event', new mongoose.Schema({}, { strict: false }));
  const Reg = conn.model('Registration', new mongoose.Schema({}, { strict: false }));

  const events = await Event.find({}).lean();
  console.log(`\n--- PRODUCTION EVENTS (${events.length}) ---`);
  events.forEach(e => {
    console.log(`ID: "${e.id}" | Sequence: ${e.sequenceNumber} | Date: "${e.date}" | Name: "${e.name}" | Capacity: ${e.capacity} | Status: "${e.status}" | isDeleted: ${e.isDeleted}`);
  });

  const regCount = await Reg.countDocuments({ isDeleted: { $ne: true } });
  console.log(`\nTotal Active Registrations in Production: ${regCount}`);

  const regSummary = await Reg.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $group: {
        _id: { programId: '$programId', programDate: '$programDate', status: '$status', isVip: '$isVip' },
        count: { $sum: 1 }
      }
    }
  ]);
  console.log('\n--- PRODUCTION REGISTRATIONS BREAKDOWN ---');
  console.log(JSON.stringify(regSummary, null, 2));

  await conn.close();
  process.exit(0);
}

checkProduction();
