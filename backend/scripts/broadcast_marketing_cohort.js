import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { sendUtilityTemplate } from '../src/integrations/whatsapp/whatsapp.service.js';

const prodUri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function broadcastMarketing() {
  if (process.argv.includes('--live')) {
    env.APP_ENV = 'production';
    env.WHATSAPP_MODE = 'production';
  }

  console.log('--- EDKL Marketing Broadcast: TBD & Past Events Pending Registrations ---');
  console.log(`WhatsApp Mode: ${env.WHATSAPP_MODE.toUpperCase()}`);
  await mongoose.connect(prodUri, { family: 4 });
  const db = mongoose.connection.db;

  const upcomingIds = ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-19'];
  const upcomingDates = ['2026-09-07', '2026-09-11', '2026-09-19'];

  // Query all pending registrations for TBD and past events
  const targetSubmissions = await db.collection('submission').find({
    programId: { $nin: upcomingIds },
    programDate: { $nin: upcomingDates },
    inquiryId: { $not: /^(EK06|EK07|EK08)/ },
    status: { $in: ['pending', 'inquiry'] },
    isDeleted: { $ne: true }
  }).toArray();

  console.log(`Found ${targetSubmissions.length} target records.`);

  // Group by unique 10-digit mobile to ensure exactly 1 message per phone number
  const phoneMap = new Map();
  targetSubmissions.forEach(sub => {
    const cleanPhone = String(sub.phoneNumber || '').replace(/\D/g, '').slice(-10);
    if (cleanPhone && cleanPhone.length === 10 && !phoneMap.has(cleanPhone)) {
      phoneMap.set(cleanPhone, sub);
    }
  });

  const uniqueRecipients = Array.from(phoneMap.values());
  console.log(`Total unique phone recipients to broadcast: ${uniqueRecipients.length}`);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < uniqueRecipients.length; i++) {
    const record = uniqueRecipients[i];
    const cleanPhone = String(record.phoneNumber || '').replace(/\D/g, '').slice(-10);
    const coupleName = `${record.husbandName || ''} & ${record.wifeName || ''}`.trim() || 'Respected Couple';

    console.log(`[${i + 1}/${uniqueRecipients.length}] Sending to ${cleanPhone} (${coupleName})...`);

    try {
      const res = await sendUtilityTemplate({
        recipientPhone: `91${cleanPhone}`,
        templateKey: 'edkl_all_couples_invite_v1',
        languageCode: 'en_US',
        variables: {
          customerName: coupleName
        },
        idempotencyKey: `MKT_BROADCAST_V1:${record.inquiryId || cleanPhone}`,
        trigger: 'marketing_broadcast',
        category: 'MARKETING'
      });

      if (res.success) {
        sent++;
      } else {
        console.warn(`Failed for ${cleanPhone}:`, res.error || res.message);
        failed++;
      }
    } catch (err) {
      console.error(`Error sending to ${cleanPhone}:`, err.message);
      failed++;
    }

    // Rate limiting: 100ms between calls to avoid hitting Meta rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n========================================`);
  console.log(`=== Broadcast Complete ===`);
  console.log(`Successfully sent: ${sent} | Failed: ${failed}`);
  console.log(`========================================`);

  await mongoose.disconnect();
}

if (process.argv.includes('--execute')) {
  broadcastMarketing().catch(err => {
    console.error('Fatal broadcast error:', err);
    process.exit(1);
  });
} else {
  console.log('SAFETY LOCK ACTIVE: Run with --execute --live to execute.');
}
