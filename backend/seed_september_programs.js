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
  sequenceNumber: { type: Number, default: 1 },
  name: { type: String, required: true },
  slug: { type: String, index: true },
  city: { type: String, default: '' },
  venue: { type: String, default: '' },
  mapUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  heroImage: { type: String, default: '' },
  price: { type: Number, default: 1000 },
  status: { type: String, default: 'upcoming' },
  featured: { type: Boolean, default: false },
  registrationMode: { type: String, enum: ['internal', 'external'], default: 'internal' },
  externalRegistrationUrl: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
  date: { type: String, required: true },
  time: { type: String, default: '8:30 PM' },
  capacity: { type: Number, required: true },
  bookingsCount: { type: Number, default: 0 },
  isDateFinal: { type: Boolean, default: true },
  cardTemplate: { type: String, default: null },
  heartX: { type: Number, default: 157 },
  heartY: { type: Number, default: 91 },
  heartWidth: { type: Number, default: 260 },
  heartHeight: { type: Number, default: 312 },
  photoZoom: { type: Number, default: 0.55 },
  photoOffsetY: { type: Number, default: 0 },
  photoLink: { type: String, default: '' },
  isInquiryClosed: { type: Boolean, default: false }
}, { collection: 'program' });

const Program = mongoose.model('Program', ProgramSchema);

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const VENUE_NAME = 'Sardar Patel Smruti Bhavan, Varachha, Surat';
  const MAP_URL = 'https://share.google/y1jtFAZXuKusYTiUD';
  const PROGRAM_NAME = 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan';

  // 1. Update 7 September 2026 Program
  const res7 = await Program.findOneAndUpdate(
    { date: '2026-09-07' },
    {
      $set: {
        name: PROGRAM_NAME,
        slug: 'surat-7-september-2026',
        city: 'Surat',
        venue: VENUE_NAME,
        mapUrl: MAP_URL,
        price: 1000,
        status: 'upcoming',
        isInquiryClosed: false,
        isDateFinal: true,
        capacity: 1184,
        time: '8:30 PM'
      }
    },
    { new: true }
  );
  console.log('✅ Updated 7 September 2026 event (Price ₹1000):', res7?.slug, 'Price:', res7?.price);

  // 2. Update 11 September 2026 Program
  const res11 = await Program.findOneAndUpdate(
    { date: '2026-09-11' },
    {
      $set: {
        name: PROGRAM_NAME,
        slug: 'surat-11-september-2026',
        city: 'Surat',
        venue: VENUE_NAME,
        mapUrl: MAP_URL,
        price: 1000,
        status: 'upcoming',
        isInquiryClosed: false,
        isDateFinal: true,
        capacity: 1184,
        time: '8:30 PM'
      }
    },
    { new: true }
  );
  console.log('✅ Updated 11 September 2026 event (Price ₹1000):', res11?.slug, 'Price:', res11?.price);

  // 3. Mark all previous test dates / TBD as completed
  await Program.updateMany(
    { date: { $nin: ['2026-09-07', '2026-09-11'] } },
    { $set: { status: 'completed' } }
  );
  console.log('✅ Previous test/August events marked as completed.');

  await mongoose.disconnect();
  console.log('Database updated successfully!');
}

run().catch(console.error);
