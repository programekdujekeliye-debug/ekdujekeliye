import mongoose from 'mongoose';

const baseUri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/?retryWrites=true&w=majority';

async function listDbs() {
  const conn = await mongoose.createConnection(baseUri).asPromise();
  const adminDb = conn.db.admin();
  const dbs = await adminDb.listDatabases();
  console.log('--- ALL DATABASES IN CLUSTER ---');
  for (const dbInfo of dbs.databases) {
    console.log(`DB: ${dbInfo.name} (${(dbInfo.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    const dbConn = conn.useDb(dbInfo.name);
    const collections = await dbConn.db.listCollections().toArray();
    console.log(`   Collections: ${collections.map(c => c.name).join(', ')}`);
    for (const coll of collections) {
      const count = await dbConn.db.collection(coll.name).countDocuments();
      console.log(`     - ${coll.name}: ${count} documents`);
    }
  }
  await conn.close();
  process.exit(0);
}

listDbs();
