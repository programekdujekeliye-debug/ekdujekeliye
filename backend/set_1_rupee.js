import mongoose from 'mongoose';
import fs from 'fs';

try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  });
} catch (e) {}

const ProgramSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  slug: { type: String, index: true },
  date: { type: String, required: true },
  price: { type: Number, default: 1499 },
  status: { type: String, default: 'upcoming' },
  city: { type: String, default: '' },
  venue: { type: String, default: '' }
}, { collection: 'program' });

const Program = mongoose.model('Program', ProgramSchema);

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Update 7 September 2026 event to ₹1
  const updated7 = await Program.findOneAndUpdate(
    { date: '2026-09-07' },
    { $set: { price: 1, date: '2026-09-07' } },
    { returnDocument: 'after' }
  );
  console.log('✅ Updated 7 September 2026 event price to ₹1:', updated7?.slug, 'Price:', updated7?.price);

  await mongoose.disconnect();
  console.log('Done!');
}

run().catch(console.error);
