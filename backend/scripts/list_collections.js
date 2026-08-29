import mongoose from 'mongoose';

async function listCollections() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
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
