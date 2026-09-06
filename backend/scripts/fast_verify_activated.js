import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import { MongoClient } from 'mongodb';

const prodUri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function main() {
  const client = new MongoClient(prodUri, { family: 4 });
  await client.connect();
  const db = client.db('ekdujekeliye');

  // 1. Events with projection
  const evs = await db.collection('program').find(
    { sequenceNumber: { $in: [6, 7] } },
    { projection: { id: 1, name: 1, date: 1, slug: 1, price: 1, capacity: 1, status: 1, isRegistrationOpen: 1, isPaymentEnabled: 1, earlyRegistrationMode: 1, personalizedInvitationEnabled: 1, sequenceNumber: 1 } }
  ).toArray();

  console.log('--- EVENTS IN PROGRAM COLLECTION ---');
  evs.forEach(e => console.log(JSON.stringify(e)));

  // 2. Legacy check
  const legacyCount = await db.collection('program').countDocuments({
    $or: [{ id: 'prog-2026-09-12' }, { date: '2026-09-12' }, { slug: 'surat-12-september-2026' }]
  });
  console.log('Legacy 12-Sep events count:', legacyCount);

  // 3. Registrations check
  const ek06Total = await db.collection('submission').countDocuments({ programId: 'prog-2026-09-07', isDeleted: { $ne: true } });
  const ek06Paid = await db.collection('submission').countDocuments({ programId: 'prog-2026-09-07', isDeleted: { $ne: true }, $or: [{ status: 'approved' }, { 'payment.status': 'captured' }] });
  const ek07Total = await db.collection('submission').countDocuments({ programId: 'prog-2026-09-11', isDeleted: { $ne: true } });
  const ek07Paid = await db.collection('submission').countDocuments({ programId: 'prog-2026-09-11', isDeleted: { $ne: true }, $or: [{ status: 'approved' }, { 'payment.status': 'captured' }] });
  const legacyRegs = await db.collection('submission').countDocuments({ $or: [{ programId: 'prog-2026-09-12' }, { programDate: '2026-09-12' }], isDeleted: { $ne: true } });
  console.log(`EK06 -> Total: ${ek06Total}, Paid: ${ek06Paid}, Unpaid: ${ek06Total - ek06Paid}`);
  console.log(`EK07 -> Total: ${ek07Total}, Paid: ${ek07Paid}, Unpaid: ${ek07Total - ek07Paid}`);
  console.log('Legacy 12-Sep registrations:', legacyRegs);

  // 4. WhatsApp Messages Check
  const openEk06 = await db.collection('whatsapp_messages').countDocuments({ eventId: 'prog-2026-09-07', trigger: 'payment_activation_open' });
  const openEk07 = await db.collection('whatsapp_messages').countDocuments({ eventId: 'prog-2026-09-11', trigger: 'payment_activation_open' });
  const remEk06 = await db.collection('whatsapp_messages').countDocuments({ eventId: 'prog-2026-09-07', trigger: 'payment_reminder_24h' });
  const remEk07 = await db.collection('whatsapp_messages').countDocuments({ eventId: 'prog-2026-09-11', trigger: 'payment_reminder_24h' });
  const cancelledInv = await db.collection('whatsapp_messages').countDocuments({ templateName: 'edkl_personal_invitation_48h_v1', status: 'CANCELLED' });
  const queuedInv = await db.collection('whatsapp_messages').countDocuments({ templateName: 'edkl_personal_invitation_48h_v1', status: 'QUEUED' });
  console.log(`Payment Open Messages -> EK06: ${openEk06}, EK07: ${openEk07}, Total: ${openEk06 + openEk07}`);
  console.log(`24h Payment Reminders Scheduled -> EK06: ${remEk06}, EK07: ${remEk07}, Total: ${remEk06 + remEk07}`);
  console.log(`Invitations -> Cancelled: ${cancelledInv}, Queued: ${queuedInv}`);

  // 5. Unrelated Events check
  const otherUpcomingEvents = await db.collection('program').find({
    sequenceNumber: { $nin: [6, 7] }
  }, { projection: { id: 1, name: 1, date: 1, sequenceNumber: 1, status: 1 } }).toArray();
  console.log('Other events unchanged count:', otherUpcomingEvents.length);

  await client.close();
  process.exit(0);
}

main();
