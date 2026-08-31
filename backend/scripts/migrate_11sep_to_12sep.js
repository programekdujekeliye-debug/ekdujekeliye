import mongoose from 'mongoose';

async function migrate() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  console.log('Connecting to Production MongoDB (ekdujekeliye)...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;

  // 1. Update Programs
  console.log('Updating programs collection...');
  const progRes = await db.collection('programs').updateMany(
    {
      $or: [
        { sequenceNumber: 7 },
        { id: 'prog-1787844313509-02' },
        { id: 'prog-2026-09-11' },
        { date: '2026-09-11' }
      ]
    },
    {
      $set: {
        date: '2026-09-12',
        slug: 'surat-12-september-2026',
        venue: 'Jamnaba Bhavan, Surat',
        name: 'Ek Duje Ke Liye - Jamnaba Bhavan',
        city: 'Surat',
        time: '8:30 PM'
      }
    }
  );
  console.log(`✓ Updated in 'programs': ${progRes.modifiedCount} documents`);

  // 2. Update Submissions (Registrations)
  console.log('Updating submission collection...');
  const subRes = await db.collection('submission').updateMany(
    {
      $or: [
        { inquiryId: { $regex: '^EK07-', $options: 'i' } },
        { programId: 'prog-1787844313509-02' },
        { programId: 'prog-2026-09-11' },
        { programDate: '2026-09-11' }
      ]
    },
    {
      $set: {
        programId: 'prog-1787844313509-02',
        programDate: '2026-09-12',
        programName: 'Ek Duje Ke Liye - Jamnaba Bhavan',
        programVenue: 'Jamnaba Bhavan, Surat',
        programTime: '8:30 PM'
      }
    }
  );
  console.log(`✓ Updated in 'submission': ${subRes.modifiedCount} registrations`);

  // 3. Update Passes
  console.log('Updating passes collection...');
  const passRes = await db.collection('passes').updateMany(
    {
      $or: [
        { inquiryId: { $regex: '^EK07-', $options: 'i' } },
        { eventId: 'prog-1787844313509-02' },
        { eventId: 'prog-2026-09-11' },
        { eventDate: '2026-09-11' }
      ]
    },
    {
      $set: {
        eventId: 'prog-1787844313509-02',
        eventDate: '2026-09-12',
        eventName: 'Ek Duje Ke Liye - Jamnaba Bhavan',
        eventVenue: 'Jamnaba Bhavan, Surat',
        eventTime: '8:30 PM'
      }
    }
  );
  console.log(`✓ Updated in 'passes': ${passRes.modifiedCount} passes`);

  // 4. Update WhatsApp Messages
  console.log('Updating whatsapp_messages collection...');
  const msgRes = await db.collection('whatsapp_messages').updateMany(
    {
      $or: [
        { eventId: 'prog-1787844313509-02' },
        { eventId: 'prog-2026-09-11' },
        { 'templateParameters.eventDate': '2026-09-11' },
        { 'templateParameters.eventDate': '11 September 2026' }
      ]
    },
    {
      $set: {
        eventId: 'prog-1787844313509-02',
        'templateParameters.eventDate': '12 September 2026',
        'templateParameters.eventName': 'Ek Duje Ke Liye - Jamnaba Bhavan',
        'templateParameters.venue': 'Jamnaba Bhavan, Surat',
        'templateParameters.eventTime': '8:30 PM'
      }
    }
  );
  console.log(`✓ Updated in 'whatsapp_messages': ${msgRes.modifiedCount} messages`);

  // 5. Verification Print
  console.log('\n--- VERIFICATION ---');
  const subs = await db.collection('submission').find({
    inquiryId: { $regex: '^EK07-', $options: 'i' }
  }).toArray();
  console.log(`Total verified EK07 registrations: ${subs.length}`);
  subs.forEach(s => {
    console.log(`  ✓ [${s.inquiryId}] ${s.husbandName} & ${s.wifeName} | Date: ${s.programDate} | Venue: ${s.programVenue} | Status: ${s.status}`);
  });

  await mongoose.disconnect();
  console.log('\nAll done successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
