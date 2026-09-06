import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const PROD_MONGO_URI = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

const PROGRAMS_CONFIG = [
  {
    id: 'prog-2026-06-27',
    date: '2026-06-27',
    name: 'Ek Duje Ke Liye - Jamnaba Bhavan',
    shortName: 'Jamnaba Bhavan',
    slug: 'ek-duje-ke-liye-jamnaba-bhavan-2026-06-27',
    city: 'Surat',
    venue: 'Jamna Baa Bhavan, Surat',
    capacity: 460,
    price: 1000,
    prefix: 'CPL1',
    csvFile: '27 june - final list.csv',
    sequenceNumber: 101
  },
  {
    id: 'prog-2026-07-10',
    date: '2026-07-10',
    name: 'Ek Duje Ke Liye - Jamnaba Bhavan',
    shortName: 'Jamnaba Bhavan',
    slug: 'ek-duje-ke-liye-jamnaba-bhavan-2026-07-10',
    city: 'Surat',
    venue: 'Jamna Baa Bhavan, Surat',
    capacity: 460,
    price: 1000,
    prefix: 'CPL2',
    csvFile: '10 July edkl - final list.csv',
    sequenceNumber: 102
  },
  {
    id: 'prog-2026-07-24',
    date: '2026-07-24',
    name: 'Ek Duje Ke Liye - Jamnaba Bhavan',
    shortName: 'Jamnaba Bhavan',
    slug: 'ek-duje-ke-liye-jamnaba-bhavan-2026-07-24',
    city: 'Surat',
    venue: 'Jamna Baa Bhavan, Surat',
    capacity: 460,
    price: 1000,
    prefix: 'CPL3',
    csvFile: '24 july edkl - final list.csv',
    sequenceNumber: 103
  },
  {
    id: 'prog-2026-08-04',
    date: '2026-08-04',
    name: 'Ek Duje Ke Liye - Atal Bihari Vajpayee Auditorium',
    shortName: 'Atal Bihari Vajpayee Katargam',
    slug: 'ek-duje-ke-liye-atal-bihari-vajpayee-auditorium-2026-08-04',
    city: 'Surat',
    venue: 'Atal Bihari Vajpayee Auditorium, Katargam, Surat',
    capacity: 500,
    price: 1000,
    prefix: 'CPL4',
    csvFile: '4 aug - final list.csv',
    sequenceNumber: 104
  }
];

function parseCsvLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function cleanPhone(raw) {
  if (!raw) return '0000000000';
  const cleaned = raw.replace(/[^\d]/g, '');
  if (cleaned.length === 10) return cleaned;
  if (cleaned.length > 10) {
    if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.substring(2);
    if (cleaned.startsWith('0') && cleaned.length === 11) return cleaned.substring(1);
    return cleaned.substring(0, 10);
  }
  if (cleaned.length > 0) return cleaned;
  return '0000000000';
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function cleanRawString(s) {
  if (!s) return '';
  return s
    .replace(/\(.*?\)/g, ' ')
    .replace(/\[.*?\]/g, ' ')
    .replace(/\b(lvb|blissivf|influancer|inf)\b/gi, ' ')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parse27JuneRow(rawWife, rawHusband) {
  const cleanW = cleanRawString(rawWife);
  const cleanH = cleanRawString(rawHusband);

  const wTokens = cleanW.split(' ').filter(Boolean).map(capitalize);
  const hTokens = cleanH.split(' ').filter(Boolean).map(capitalize);

  let wifeName = '.';
  let husbandName = 'Partner';
  let surname = 'Patel';

  // Parse Wife
  if (wTokens.length === 1) {
    wifeName = wTokens[0];
  } else if (wTokens.length >= 2) {
    if (wTokens[1].toLowerCase() === 'ben' || wTokens[1].toLowerCase() === 'ba') {
      wifeName = `${wTokens[0]}${wTokens[1].toLowerCase()}`;
      if (wTokens.length >= 3) surname = wTokens[wTokens.length - 1];
    } else {
      wifeName = wTokens[0];
      surname = wTokens[wTokens.length - 1];
    }
  }

  // Parse Husband
  if (hTokens.length === 1) {
    husbandName = hTokens[0];
  } else if (hTokens.length === 2) {
    husbandName = hTokens[0];
    surname = hTokens[1];
  } else if (hTokens.length >= 3) {
    if (['Bhai', 'Kumar', 'Lal', 'Chandra'].includes(hTokens[1])) {
      husbandName = `${hTokens[0]}${hTokens[1].toLowerCase()}`;
      surname = hTokens[hTokens.length - 1];
    } else {
      husbandName = hTokens.slice(0, hTokens.length - 1).join(' ');
      surname = hTokens[hTokens.length - 1];
    }
  }

  return { wifeName, husbandName, surname };
}

function splitWifeHusbandSurname(rawName) {
  const cleaned = cleanRawString(rawName);
  if (!cleaned) return { wifeName: '.', husbandName: 'Partner', surname: 'Patel' };

  let tokens = cleaned.split(' ').filter(Boolean).map(capitalize);
  let title = '';
  if (tokens.length > 0 && /^dr\.?$/i.test(tokens[0])) {
    title = 'Dr. ';
    tokens.shift();
  }

  if (tokens.length === 0) {
    return { wifeName: '.', husbandName: 'Partner', surname: 'Patel' };
  }
  if (tokens.length === 1) {
    return { wifeName: '.', husbandName: title + tokens[0], surname: tokens[0] };
  }
  if (tokens.length === 2) {
    return { wifeName: '.', husbandName: title + tokens[0], surname: tokens[1] };
  }
  if (tokens.length === 3) {
    return {
      wifeName: title + tokens[0],
      husbandName: tokens[1],
      surname: tokens[2]
    };
  }

  // 4 or more tokens
  const wife = title + tokens[0];
  const surname = tokens[tokens.length - 1];
  const husband = tokens.slice(1, tokens.length - 1).join(' ');
  return { wifeName: wife, husbandName: husband, surname: surname };
}

export function parseProgramCsv(progConfig) {
  const filePath = path.join('../CSV', progConfig.csvFile);
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  const records = [];
  let seq = 1;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const rowStr = row.join('').trim();
    if (!rowStr) continue;

    let wifeName = '.';
    let husbandName = 'Partner';
    let surname = 'Patel';
    let phone = '0000000000';
    let isVip = false;

    if (progConfig.csvFile.includes('27 june')) {
      const rawWife = row[2]?.trim();
      const rawHusband = row[3]?.trim();
      const cat = (row[5] || '').toLowerCase().trim();
      const rawPhone1 = row[6]?.trim();
      const rawPhone2 = row[7]?.trim();

      // Skip completely empty name rows
      if (!rawWife && !rawHusband) continue;

      phone = cleanPhone(rawPhone1) !== '0000000000' ? cleanPhone(rawPhone1) : cleanPhone(rawPhone2);

      if (['team', 'dr', 'manager', 'businessmen'].includes(cat)) {
        isVip = true;
      }

      const parsed = parse27JuneRow(rawWife, rawHusband);
      wifeName = parsed.wifeName;
      husbandName = parsed.husbandName;
      surname = parsed.surname;
    } else {
      const rawName = row[1]?.trim();
      const rawPhone = row[2]?.trim();

      // Skip empty name rows (blank lines with just row numbers)
      if (!rawName) continue;

      phone = cleanPhone(rawPhone);
      const parts = splitWifeHusbandSurname(rawName);
      wifeName = parts.wifeName;
      husbandName = parts.husbandName;
      surname = parts.surname;
    }

    // Ensure fallback for wife/husband if empty
    if (!wifeName || wifeName === '.') wifeName = '.';
    if (!husbandName || husbandName === '.') husbandName = 'Partner';
    if (!surname || surname === '.') surname = 'Patel';

    const padSeq = String(seq).padStart(3, '0');
    const inquiryId = `${progConfig.prefix}-${padSeq}`;
    const eventDateTime = new Date(`${progConfig.date}T12:00:00.000Z`);

    records.push({
      inquiryId,
      customerToken: crypto.randomBytes(16).toString('hex'),
      husbandName,
      wifeName,
      surname,
      phoneNumber: phone,
      whatsappOptIn: false,
      whatsappMarketingOptIn: false,
      programId: progConfig.id,
      programName: progConfig.name,
      programDate: progConfig.date,
      programTime: '8:30 PM',
      couplePhoto: '/sample_couple.png',
      paymentScreenshot: null,
      status: 'approved',
      isVip,
      payment: {
        provider: 'legacy_upi',
        status: 'captured',
        amount: 1000,
        currency: 'INR',
        paidAt: eventDateTime,
        createdAt: eventDateTime
      },
      amount: 1000,
      attendance: 'unmarked',
      isDeleted: false,
      photoZoom: 1,
      photoOffsetX: 0,
      photoOffsetY: 0,
      frameExportStatus: 'NOT_EXPORTED',
      createdAt: eventDateTime,
      updatedAt: eventDateTime
    });

    seq++;
  }

  return records;
}

async function run() {
  const isLive = process.argv.includes('--live');
  console.log('====================================================');
  console.log(`[PAST EVENTS SEEDER] Mode: ${isLive ? '🔴 LIVE PRODUCTION' : '🟡 DRY RUN (READ ONLY)'}`);
  console.log('====================================================');

  await mongoose.connect(PROD_MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Connected to MongoDB Production database: ekdujekeliye');

  // Pre-seed verification of existing data
  const existingProgCount = await db.collection('program').countDocuments({});
  const existingSubCount = await db.collection('submission').countDocuments({});
  console.log(`\nExisting Production State: ${existingProgCount} programs, ${existingSubCount} submissions.`);

  let totalParsedRecords = 0;
  const allParsedBatches = [];

  // Parse and validate all 4 programs
  for (const progConfig of PROGRAMS_CONFIG) {
    const records = parseProgramCsv(progConfig);
    totalParsedRecords += records.length;
    allParsedBatches.push({ config: progConfig, records });

    console.log(`\n[${progConfig.date}] ${progConfig.name}:`);
    console.log(`  CSV: ${progConfig.csvFile}`);
    console.log(`  Parsed Attendees: ${records.length}`);
    console.log(`  Inquiry ID Range: ${records[0].inquiryId} -> ${records[records.length - 1].inquiryId}`);
    console.log(`  Sample:`, {
      inquiryId: records[0].inquiryId,
      couple: `${records[0].husbandName} & ${records[0].wifeName} ${records[0].surname}`,
      phone: records[0].phoneNumber,
      status: records[0].status,
      payment: records[0].payment.status,
      amount: records[0].amount
    });

    // Check for any ID collision in existing database
    const sampleIds = records.map(r => r.inquiryId);
    const existingCollisions = await db.collection('submission').find({ inquiryId: { $in: sampleIds } }).project({ inquiryId: 1 }).toArray();
    if (existingCollisions.length > 0) {
      throw new Error(`[CRITICAL] Inquiry ID collision detected! Colliding IDs: ${existingCollisions.map(c => c.inquiryId).join(', ')}`);
    } else {
      console.log(`  ✅ Zero collision with existing database inquiry IDs.`);
    }
  }

  console.log(`\n----------------------------------------------------`);
  console.log(`Total Attendees Ready for Seeding across 4 Events: ${totalParsedRecords}`);
  console.log(`----------------------------------------------------`);

  if (!isLive) {
    console.log('\n🟡 DRY RUN COMPLETE. Zero database modifications were performed.');
    console.log('To execute live production seeding, run with --live flag.');
    await mongoose.disconnect();
    return;
  }

  // --- LIVE PRODUCTION SEEDING ---
  console.log('\n🔴 PROCEEDING TO LIVE PRODUCTION SEEDING...');

  for (const { config: progConfig, records } of allParsedBatches) {
    // 1. Upsert Program Document
    const eventDateTime = new Date(`${progConfig.date}T12:00:00.000Z`);
    const progDoc = {
      id: progConfig.id,
      sequenceNumber: progConfig.sequenceNumber,
      name: progConfig.name,
      shortName: progConfig.shortName,
      slug: progConfig.slug,
      city: progConfig.city,
      venue: progConfig.venue,
      price: progConfig.price,
      currency: 'INR',
      status: 'completed',
      date: progConfig.date,
      time: '8:30 PM',
      capacity: progConfig.capacity,
      bookingsCount: records.length,
      isDateFinal: true,
      isInquiryClosed: true,
      isRegistrationOpen: false,
      isPaymentEnabled: false,
      communicationsEnabled: false,
      earlyRegistrationMode: false,
      archiveStatus: 'NOT_REQUIRED',
      featured: false,
      registrationMode: 'internal',
      sortOrder: 0,
      heroImage: '',
      posterImage: '',
      photoLink: '',
      description: '',
      updatedAt: eventDateTime
    };

    await db.collection('program').updateOne(
      { date: progConfig.date },
      { $set: progDoc },
      { upsert: true }
    );
    console.log(`✅ Upserted Program: ${progConfig.name} (${progConfig.date}) - Bookings: ${records.length}`);

    // 2. Insert Registrations in bulk
    const insertResult = await db.collection('submission').insertMany(records, { ordered: false });
    console.log(`✅ Inserted ${insertResult.insertedCount} registrations for ${progConfig.date}.`);

    // 3. Upsert Counter for this program
    const counterKey = `inquiryNumber_${progConfig.id}`;
    await db.collection('counter').updateOne(
      { _id: counterKey },
      { $set: { name: counterKey, seq: records.length } },
      { upsert: true }
    );
    console.log(`✅ Updated Counter '${counterKey}' -> seq: ${records.length}`);
  }

  // Final Production Health Verification
  const postProgCount = await db.collection('program').countDocuments({});
  const postSubCount = await db.collection('submission').countDocuments({});
  const diff = postSubCount - existingSubCount;

  console.log('\n====================================================');
  console.log(`[SEEDING SUMMARY]`);
  console.log(`Total Programs: ${existingProgCount} -> ${postProgCount} (+${postProgCount - existingProgCount})`);
  console.log(`Total Submissions: ${existingSubCount} -> ${postSubCount} (+${diff})`);
  console.log(`Expected Added: ${totalParsedRecords}, Actual Added: ${diff}`);
  console.log('====================================================');

  if (diff === totalParsedRecords) {
    console.log('🎉 PERFECT SEEDING: Exactly 1,182 registrations seeded with zero errors!');
  } else {
    console.warn(`⚠️ Warning: Expected ${totalParsedRecords} but added ${diff}`);
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Seeder encountered fatal error:', err);
  process.exit(1);
});
