import { MongoClient } from 'mongodb';

const prodUri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function run() {
  const client = new MongoClient(prodUri);
  await client.connect();
  const db = client.db('ekdujekeliye');
  console.log('--- CONNECTED VIA MONGOCLIENT TO ekdujekeliye ---');

  const programDocs = await db.collection('program').find({}).toArray();
  console.log(`\n=== 'program' (${programDocs.length} docs) ===`);
  programDocs.forEach(p => {
    console.log(`ID: "${p.id}" | Seq: ${p.sequenceNumber} | Date: "${p.date}" | Name: "${p.name}" | Cap: ${p.capacity} | Status: "${p.status}"`);
  });

  const programsDocs = await db.collection('programs').find({}).toArray();
  console.log(`\n=== 'programs' (${programsDocs.length} docs) ===`);
  programsDocs.forEach(p => {
    console.log(`ID: "${p.id}" | Seq: ${p.sequenceNumber} | Date: "${p.date}" | Name: "${p.name}" | Cap: ${p.capacity} | Status: "${p.status}"`);
  });

  const subCount = await db.collection('submission').countDocuments({});
  console.log(`\n=== 'submission' (${subCount} docs) ===`);

  const distinctProgramIds = await db.collection('submission').distinct('programId');
  console.log('Distinct programIds in submission:', distinctProgramIds);

  const distinctProgramDates = await db.collection('submission').distinct('programDate');
  console.log('Distinct programDates in submission:', distinctProgramDates);

  const breakdown = await db.collection('submission').aggregate([
    { $group: { _id: { programId: '$programId', programDate: '$programDate', status: '$status' }, count: { $sum: 1 } } }
  ]).toArray();
  console.log('\nBreakdown:', JSON.stringify(breakdown, null, 2));

  await client.close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
