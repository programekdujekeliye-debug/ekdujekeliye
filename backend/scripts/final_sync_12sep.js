import mongoose from 'mongoose';

async function finalSync() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;

  console.log('--- FINAL UNIFIED SYNC (12 September) ---');

  // Update in 'program'
  const p1 = await db.collection('program').updateMany(
    {
      $or: [
        { sequenceNumber: 7 },
        { id: 'prog-2026-09-11' },
        { id: 'prog-1787844313509-02' }
      ]
    },
    {
      $set: {
        date: '2026-09-12',
        slug: 'surat-12-september-2026',
        name: 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan',
        venue: 'Sardar Patel Smruti Bhavan, Varachha, Surat',
        city: 'Surat',
        time: '8:30 PM'
      }
    }
  );
  console.log(`Updated in 'program': ${p1.modifiedCount}`);

  // Update in 'programs'
  const p2 = await db.collection('programs').updateMany(
    {
      $or: [
        { sequenceNumber: 7 },
        { id: 'prog-2026-09-11' },
        { id: 'prog-1787844313509-02' }
      ]
    },
    {
      $set: {
        date: '2026-09-12',
        slug: 'surat-12-september-2026',
        name: 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan',
        venue: 'Sardar Patel Smruti Bhavan, Varachha, Surat',
        city: 'Surat',
        time: '8:30 PM'
      }
    }
  );
  console.log(`Updated in 'programs': ${p2.modifiedCount}`);

  // Update all registrations in 'submission'
  const subRes = await db.collection('submission').updateMany(
    {
      $or: [
        { inquiryId: { $regex: '^EK07-', $options: 'i' } },
        { programId: 'prog-2026-09-11' },
        { programId: 'prog-1787844313509-02' }
      ]
    },
    {
      $set: {
        programDate: '2026-09-12',
        programTime: '8:30 PM',
        programName: 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan',
        programVenue: 'Sardar Patel Smruti Bhavan, Varachha, Surat'
      }
    }
  );
  console.log(`Updated in 'submission' (registrations): ${subRes.modifiedCount}`);

  // Update all queued whatsapp messages
  const msgRes = await db.collection('whatsapp_messages').updateMany(
    {
      $or: [
        { inquiryId: { $regex: '^EK07-', $options: 'i' } },
        { eventId: 'prog-2026-09-11' },
        { eventId: 'prog-1787844313509-02' }
      ]
    },
    {
      $set: {
        'templateParameters.eventDate': '12 September 2026',
        'templateParameters.eventName': 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan',
        'templateParameters.venue': 'Sardar Patel Smruti Bhavan, Varachha, Surat',
        'templateParameters.eventTime': '8:30 PM'
      }
    }
  );
  console.log(`Updated in 'whatsapp_messages': ${msgRes.modifiedCount}`);

  // Verify
  const sample = await db.collection('submission').find({ inquiryId: { $regex: '^EK07-', $options: 'i' } }).toArray();
  console.log(`\nVerified EK07 Registrations count: ${sample.length}`);
  sample.forEach(s => {
    console.log(`  ✓ [${s.inquiryId}] ${s.husbandName} & ${s.wifeName} | Date: ${s.programDate} | Venue: ${s.programVenue} | Event: ${s.programName}`);
  });

  await mongoose.disconnect();
  process.exit(0);
}

finalSync().catch(err => {
  console.error(err);
  process.exit(1);
});
