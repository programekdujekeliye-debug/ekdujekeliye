import mongoose from 'mongoose';

const uri = process.env.PROD_MONGO_URI || process.env.MONGO_URI;

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const docs = await db.collection('counter').find({}).toArray();
  console.log('Total counter documents:', docs.length);
  for (const d of docs) {
    console.log(JSON.stringify(d));
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
