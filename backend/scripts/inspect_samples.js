import { MongoClient } from 'mongodb';

const prodUri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function run() {
  const client = new MongoClient(prodUri);
  await client.connect();
  const db = client.db('ekdujekeliye');
  
  console.log('--- CHECKING PROGRAMS IN PROD ---');
  const progs1 = await db.collection('program').find({}).limit(10).toArray();
  console.log(`program collection (limit 10): ${progs1.length} found`);
  progs1.forEach(p => console.log(JSON.stringify({ id: p.id, name: p.name, date: p.date, capacity: p.capacity, status: p.status })));

  const progs2 = await db.collection('programs').find({}).limit(10).toArray();
  console.log(`\nprograms collection (limit 10): ${progs2.length} found`);
  progs2.forEach(p => console.log(JSON.stringify({ id: p.id, name: p.name, date: p.date, capacity: p.capacity, status: p.status })));

  const subs = await db.collection('submission').find({}).limit(5).toArray();
  console.log(`\nsubmission collection sample (5):`);
  subs.forEach(s => console.log(JSON.stringify({ inquiryId: s.inquiryId, name: s.husbandName, date: s.programDate, programId: s.programId, status: s.status })));

  await client.close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
