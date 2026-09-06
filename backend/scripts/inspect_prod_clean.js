import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import mongoose from 'mongoose';

const prodUri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function run() {
  const client = await mongoose.connect(prodUri, {
    family: 4,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000
  });
  console.log('Connected to ekdujekeliye production database.');

  const db = client.connection.db;

  const programDocs = await db.collection('program').find({}).toArray();
  console.log(`\n=== 'program' collection (${programDocs.length} docs) ===`);
  programDocs.forEach(p => {
    console.log(`ID: "${p.id}" | Seq: ${p.sequenceNumber} | Date: "${p.date}" | Name: "${p.name}" | Cap: ${p.capacity} | Status: "${p.status}"`);
  });

  const programsDocs = await db.collection('programs').find({}).toArray();
  console.log(`\n=== 'programs' collection (${programsDocs.length} docs) ===`);
  programsDocs.forEach(p => {
    console.log(`ID: "${p.id}" | Seq: ${p.sequenceNumber} | Date: "${p.date}" | Name: "${p.name}" | Cap: ${p.capacity} | Status: "${p.status}"`);
  });

  const subCount = await db.collection('submission').countDocuments({});
  console.log(`\n=== 'submission' collection has ${subCount} total documents ===`);

  const distinctProgramIds = await db.collection('submission').distinct('programId');
  console.log('Distinct programIds in submission:', distinctProgramIds);

  const distinctProgramDates = await db.collection('submission').distinct('programDate');
  console.log('Distinct programDates in submission:', distinctProgramDates);

  const countsByProgram = await db.collection('submission').aggregate([
    { $group: { _id: { programId: '$programId', status: '$status' }, count: { $sum: 1 } } }
  ]).toArray();
  console.log('Submission count by programId & status:', JSON.stringify(countsByProgram, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
