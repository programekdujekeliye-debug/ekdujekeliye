import mongoose from 'mongoose';

async function check() {
  const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;

  const liveEvents = await db.collection('program').find({
    sequenceNumber: { $in: [6, 7] }
  }).toArray();

  console.log("Live Events in 'program' collection (used by backend/website):");
  liveEvents.forEach(e => {
    console.log(`  ✓ [#${e.sequenceNumber}] ${e.name} (${e.date}) => Price: ₹${e.price}`);
  });

  const altEvents = await db.collection('programs').find({
    sequenceNumber: { $in: [6, 7] }
  }).toArray();

  console.log("\nEvents in 'programs' collection:");
  altEvents.forEach(e => {
    console.log(`  ✓ [#${e.sequenceNumber}] ${e.name} (${e.date}) => Price: ₹${e.price}`);
  });

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
