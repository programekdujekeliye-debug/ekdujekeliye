import mongoose from 'mongoose';

async function fixPrices() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;

  console.log('Fixing price in both program and programs collections to 1500...');

  // Update in 'programs'
  await db.collection('programs').updateMany(
    { price: 1499 },
    { $set: { price: 1500 } }
  );

  // Update in 'program'
  await db.collection('program').updateMany(
    { price: 1499 },
    { $set: { price: 1500 } }
  );

  console.log('\n--- VERIFICATION OF BOTH COLLECTIONS ---');
  
  const progItems = await db.collection('program').find({}).toArray();
  console.log(`\n'program' collection (Live collection used by Mongoose):`);
  progItems.forEach(p => console.log(`  [${p.id || p.sequenceNumber}] ${p.name} (${p.date}) => ₹${p.price}`));

  const progsItems = await db.collection('programs').find({}).toArray();
  console.log(`\n'programs' collection:`);
  progsItems.forEach(p => console.log(`  [${p.id || p.sequenceNumber}] ${p.name} (${p.date}) => ₹${p.price}`));

  await mongoose.disconnect();
  console.log('\nDone!');
  process.exit(0);
}

fixPrices().catch(err => {
  console.error(err);
  process.exit(1);
});
