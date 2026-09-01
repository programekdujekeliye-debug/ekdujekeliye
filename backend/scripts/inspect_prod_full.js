import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import mongoose from 'mongoose';

const prodUri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function inspectProd() {
  const conn = await mongoose.createConnection(prodUri, {
    family: 4,
    serverSelectionTimeoutMS: 15000
  }).asPromise();

  
  const Program = conn.model('Program', new mongoose.Schema({}, { strict: false, collection: 'program' }));
  const Submission = conn.model('Submission', new mongoose.Schema({}, { strict: false, collection: 'submission' }));

  const programs = await Program.find({}).lean();
  console.log(`=== PRODUCTION 'program' COLLECTION (${programs.length} events) ===`);
  programs.forEach(p => {
    console.log(`ID: "${p.id}" | Sequence: ${p.sequenceNumber} | Date: "${p.date}" | Name: "${p.name}" | Capacity: ${p.capacity} | Status: "${p.status}"`);
  });

  const totalSubmissions = await Submission.countDocuments({});
  const activeSubmissions = await Submission.countDocuments({ isDeleted: { $ne: true } });
  console.log(`\n=== PRODUCTION 'submission' COLLECTION ===`);
  console.log(`Total: ${totalSubmissions}, Active: ${activeSubmissions}`);

  const breakdown = await Submission.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $group: {
        _id: { programId: '$programId', programDate: '$programDate', status: '$status' },
        count: { $sum: 1 }
      }
    }
  ]);
  console.log('\nBreakdown by programId / programDate:');
  console.log(JSON.stringify(breakdown, null, 2));

  await conn.close();
  process.exit(0);
}

inspectProd();
