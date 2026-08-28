import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Event } from '../src/models/Event.js';
import { Setting } from '../src/models/Setting.js';

async function runMigration() {
  const uri = env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is missing from environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');

  // 1. Migrate Global Settings
  let setting = await Setting.findOne({ key: 'global' });
  if (!setting) {
    console.log('Creating initial global settings document...');
    setting = new Setting({
      key: 'global',
      brandName: 'Ek Duje Ke Liye',
      supportPhone: '+91 98251 00000',
      supportWhatsapp: '+91 98251 00000',
      supportEmail: 'contact@ekdujekeliye.in',
      websiteEmail: 'info@ekdujekeliye.in',
      defaultCity: 'Surat',
      defaultCountry: 'India',
      defaultCurrency: 'INR',
      defaultPrice: 1500,
      defaultSpeakerName: 'Manish Vaghasiya',
      defaultSpeakerTitle: 'Couple Relationship Counselor & Life Coach'
    });
    await setting.save();
    console.log('Global settings created.');
  } else {
    console.log('Updating existing global settings defaults if missing...');
    if (!setting.brandName) setting.brandName = 'Ek Duje Ke Liye';
    if (!setting.defaultCity) setting.defaultCity = 'Surat';
    if (!setting.defaultCurrency) setting.defaultCurrency = 'INR';
    if (!setting.defaultPrice) setting.defaultPrice = 1500;
    if (!setting.defaultSpeakerName) setting.defaultSpeakerName = 'Manish Vaghasiya';
    if (!setting.defaultSpeakerTitle) setting.defaultSpeakerTitle = 'Couple Relationship Counselor & Life Coach';
    await setting.save();
    console.log('Global settings verified.');
  }

  // 2. Backfill Event records with structured fields
  const events = await Event.find({});
  console.log(`Found ${events.length} event records to inspect/backfill.`);

  let updatedCount = 0;
  for (const ev of events) {
    let changed = false;

    if (ev.shortName === undefined) { ev.shortName = ''; changed = true; }
    if (ev.venueAddress === undefined) { ev.venueAddress = ''; changed = true; }
    if (ev.headline === undefined) { ev.headline = ''; changed = true; }
    if (ev.subheadline === undefined) { ev.subheadline = ''; changed = true; }
    if (ev.highlights === undefined) { ev.highlights = []; changed = true; }
    if (ev.instructions === undefined) { ev.instructions = ''; changed = true; }
    if (ev.posterImage === undefined) { ev.posterImage = ''; changed = true; }
    if (ev.currency === undefined) { ev.currency = 'INR'; changed = true; }
    if (ev.contactPhone === undefined) { ev.contactPhone = ''; changed = true; }
    if (ev.contactWhatsapp === undefined) { ev.contactWhatsapp = ''; changed = true; }
    if (ev.contactEmail === undefined) { ev.contactEmail = ''; changed = true; }
    if (ev.speakerName === undefined) { ev.speakerName = 'Manish Vaghasiya'; changed = true; }
    if (ev.speakerTitle === undefined) { ev.speakerTitle = 'Couple Relationship Counselor & Life Coach'; changed = true; }
    if (ev.speakerImage === undefined) { ev.speakerImage = ''; changed = true; }
    if (ev.speakerBio === undefined) { ev.speakerBio = ''; changed = true; }
    if (ev.ctaLabel === undefined) { ev.ctaLabel = 'Book Couple Pass'; changed = true; }
    if (ev.passTitle === undefined) { ev.passTitle = ''; changed = true; }
    if (ev.passInstructions === undefined) { ev.passInstructions = ''; changed = true; }
    if (ev.seoTitle === undefined) { ev.seoTitle = ''; changed = true; }
    if (ev.seoDescription === undefined) { ev.seoDescription = ''; changed = true; }

    if (changed) {
      await ev.save();
      updatedCount++;
    }
  }

  console.log(`Successfully migrated ${updatedCount} event records.`);
  await mongoose.disconnect();
  console.log('Migration complete. Disconnected.');
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
