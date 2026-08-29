import mongoose from 'mongoose';

async function check() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const singular = await db.collection('program').find({}).toArray();
  console.log(`\n=== 'program' (singular) collection count: ${singular.length} ===`);
  singular.forEach(e => {
    console.log(`- [${e.id || e._id}] Date: ${e.date} | Name: ${e.name} | Status: ${e.status}`);
  });

  const plural = await db.collection('programs').find({}).toArray();
  console.log(`\n=== 'programs' (plural) collection count: ${plural.length} ===`);
  plural.forEach(e => {
    console.log(`- [${e.id || e._id}] Date: ${e.date} | Name: ${e.name} | Status: ${e.status}`);
  });

  process.exit(0);
}

check().catch(console.error);
