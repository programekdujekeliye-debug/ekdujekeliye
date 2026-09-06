import mongoose from 'mongoose';

async function listCollections() {
  const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  console.log('Collections in prod DB:', cols.map(c => c.name));

  for (const c of cols) {
    if (c.name.toLowerCase().includes('event') || c.name.toLowerCase().includes('prog')) {
      const docs = await db.collection(c.name).find({}).toArray();
      console.log(`\n--- Documents in "${c.name}" (Count: ${docs.length}) ---`);
      docs.forEach(d => console.log(JSON.stringify(d, null, 2)));
    }
  }

  process.exit(0);
}

listCollections().catch(console.error);
