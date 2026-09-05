import mongoose from 'mongoose';

const uri = "mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/?retryWrites=true&w=majority";

async function run() {
  const conn = await mongoose.connect(uri);
  const admin = conn.connection.db.admin();
  const dbs = await admin.listDatabases();
  console.log('Databases on Cluster0:');
  dbs.databases.forEach(d => console.log(` - ${d.name} (${Math.round(d.sizeOnDisk / 1024)} KB)`));

  // Check collections in ekdujekeliye and ekdujekeliye_test
  for (const dbName of ['ekdujekeliye', 'ekdujekeliye_test']) {
    const db = conn.connection.useDb(dbName);
    const cols = await db.db.listCollections().toArray();
    console.log(`\nCollections in ${dbName}:`);
    for (const c of cols) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`  - ${c.name}: ${count} docs`);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
