import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import mongoose from 'mongoose';

async function inspect() {
  const uri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);
  console.log('Connecting to Production MongoDB (ekdujekeliye)...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, family: 4 });
  const db = mongoose.connection.db;

  console.log('\n--- 1. Checking Events in "program" & "programs" ---');
  const progs1 = await db.collection('program').find({
    $or: [
      { sequenceNumber: 7 },
      { date: { $in: ['2026-09-11', '2026-09-12'] } },
      { id: { $in: ['prog-2026-09-11', 'prog-2026-09-12', 'prog-1787844313509-02'] } }
    ]
  }).toArray();
  console.log(`Events in 'program': ${progs1.length}`);
  progs1.forEach(p => console.log(' ', JSON.stringify({ id: p.id, seq: p.sequenceNumber, name: p.name, date: p.date, slug: p.slug, earlyMode: p.earlyRegistrationMode })));

  const progs2 = await db.collection('programs').find({
    $or: [
      { sequenceNumber: 7 },
      { date: { $in: ['2026-09-11', '2026-09-12'] } },
      { id: { $in: ['prog-2026-09-11', 'prog-2026-09-12', 'prog-1787844313509-02'] } }
    ]
  }).toArray();
  console.log(`Events in 'programs': ${progs2.length}`);
  progs2.forEach(p => console.log(' ', JSON.stringify({ id: p.id, seq: p.sequenceNumber, name: p.name, date: p.date, slug: p.slug, earlyMode: p.earlyRegistrationMode })));

  console.log('\n--- 2. Checking EK07 Registrations in "submission" ---');
  const subs = await db.collection('submission').find({
    $or: [
      { inquiryId: { $regex: '^EK07-', $options: 'i' } },
      { programDate: { $in: ['2026-09-11', '2026-09-12'] } },
      { programId: { $in: ['prog-2026-09-11', 'prog-2026-09-12', 'prog-1787844313509-02'] } }
    ]
  }).toArray();
  console.log(`Found ${subs.length} matching submissions:`);
  subs.forEach(s => console.log(' ', JSON.stringify({ id: s.inquiryId, date: s.programDate, progId: s.programId, phone: s.phoneNumber, name: `${s.husbandName} & ${s.wifeName}` })));

  console.log('\n--- 3. Checking Counters ---');
  const counters = await db.collection('counters').find({
    $or: [
      { _id: { $regex: 'inquiryNumber', $options: 'i' } },
      { name: { $regex: 'inquiryNumber', $options: 'i' } }
    ]
  }).toArray();
  console.log('Counters:', counters);

  console.log('\n--- 4. Checking WhatsApp Messages for EK07 ---');
  const msgs = await db.collection('whatsapp_messages').find({
    $or: [
      { inquiryId: { $regex: '^EK07-', $options: 'i' } },
      { eventId: { $in: ['prog-2026-09-11', 'prog-2026-09-12', 'prog-1787844313509-02'] } }
    ]
  }).toArray();
  console.log(`Found ${msgs.length} whatsapp messages`);
  msgs.forEach(m => console.log(' ', JSON.stringify({ id: m.inquiryId, eventId: m.eventId, eventDate: m.templateParameters?.eventDate, status: m.status })));

  console.log('\n--- 5. Checking Passes for EK07 ---');
  const passes = await db.collection('passes').find({
    $or: [
      { inquiryId: { $regex: '^EK07-', $options: 'i' } },
      { eventId: { $in: ['prog-2026-09-11', 'prog-2026-09-12', 'prog-1787844313509-02'] } }
    ]
  }).toArray();
  console.log(`Found ${passes.length} passes`);
  passes.forEach(p => console.log(' ', JSON.stringify({ id: p.inquiryId, eventId: p.eventId, eventDate: p.eventDate })));

  await mongoose.disconnect();
  console.log('\nDone.');
  process.exit(0);
}

inspect().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});
