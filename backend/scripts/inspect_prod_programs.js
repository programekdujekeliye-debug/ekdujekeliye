import mongoose from 'mongoose';

async function checkEvents() {
  const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  
  // Check 'program' (live collection used by backend Mongoose Event model)
  const program = await db.collection('program').find({}).toArray();
  console.log(`\n=== Live 'program' collection (Count: ${program.length}) ===`);
  program.forEach(e => {
    console.log(`  [Sequence #${e.sequenceNumber}] ${e.name} (${e.date}) => Price: ₹${e.price}`);
  });

  // Check 'programs'
  const programs = await db.collection('programs').find({}).toArray();
  console.log(`\n=== 'programs' collection (Count: ${programs.length}) ===`);
  programs.forEach(e => {
    console.log(`  [Sequence #${e.sequenceNumber}] ${e.name} (${e.date}) => Price: ₹${e.price}`);
  });

  process.exit(0);
}

checkEvents().catch(console.error);
