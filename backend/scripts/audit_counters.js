import mongoose from 'mongoose';

const uri = process.env.PROD_MONGO_URI || process.env.MONGO_URI;

async function main() {
  await mongoose.connect(uri);

  const CounterSchema = new mongoose.Schema({}, { strict: false });
  const Counter = mongoose.model('Counter', CounterSchema, 'counters');

  const allCounters = await Counter.find({}).lean();
  console.log('All counters in DB:');
  for (const c of allCounters) {
    console.log(`${c._id}: ${c.seq || c.sequence_value || c.val}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
