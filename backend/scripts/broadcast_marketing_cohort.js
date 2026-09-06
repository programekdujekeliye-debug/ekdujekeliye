import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { sendUtilityTemplate } from '../src/integrations/whatsapp/whatsapp.service.js';

const prodUri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function broadcastRichRoyal() {
  if (process.argv.includes('--live')) {
    env.APP_ENV = 'production';
    env.WHATSAPP_MODE = 'production';
  }

  console.log('================================================================');
  console.log('RICH & ROYAL SALON — WHATSAPP MARKETING BROADCAST');
  console.log('================================================================');
  console.log(`WhatsApp Mode: ${env.WHATSAPP_MODE.toUpperCase()}`);
  console.log(`Template: edkl_september_special_invite_v1 (Gujarati)`);
  console.log(`Live Execution Flag: ${process.argv.includes('--execute') ? 'YES' : 'NO'}`);
  console.log('================================================================\n');

  await mongoose.connect(prodUri, { family: 4 });
  const db = mongoose.connection.db;

  const contactsPath = path.resolve(process.cwd(), 'data/rich_royal_clean_contacts.json');
  if (!fs.existsSync(contactsPath)) {
    console.error('File not found:', contactsPath);
    process.exit(1);
  }

  const contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
  console.log(`Total Clean Contacts Loaded: ${contacts.length}`);

  // Fetch already sent phone numbers for this template to avoid duplicates
  const alreadySent = await db.collection('whatsapp_messages').find({
    templateName: 'edkl_september_special_invite_v1',
    trigger: 'marketing_broadcast',
    status: { $in: ['SENT', 'DELIVERED', 'READ'] }
  }, { projection: { recipientPhone: 1 } }).toArray();

  const sentSet = new Set(alreadySent.map(m => (m.recipientPhone || '').slice(-10)));
  console.log(`Already sent: ${sentSet.size} contacts.`);

  const remaining = contacts.filter(c => !sentSet.has(c.phone));
  console.log(`Remaining to send: ${remaining.length} contacts.\n`);

  if (!process.argv.includes('--execute')) {
    console.log('DRY RUN COMPLETE. To launch live broadcast, run with: node scripts/broadcast_marketing_cohort.js --execute --live');
    await mongoose.disconnect();
    return;
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < remaining.length; i++) {
    const c = remaining[i];
    const phone = c.phone;

    try {
      const res = await sendUtilityTemplate({
        recipientPhone: `91${phone}`,
        templateKey: 'edkl_september_special_invite_v1',
        languageCode: 'gu',
        variables: {},
        idempotencyKey: `RR_BROADCAST_SEPT2026:${phone}`,
        trigger: 'marketing_broadcast',
        category: 'MARKETING'
      });

      if (res.success) {
        sent++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      console.error(`Error sending to ${phone}:`, err.message);
    }

    if ((i + 1) % 50 === 0 || i === remaining.length - 1) {
      const now = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' });
      console.log(`[${now} IST] Progress: ${i + 1}/${remaining.length} (${Math.round(((i + 1) / remaining.length) * 100)}%) | Sent: ${sent} | Failed: ${failed}`);
    }

    // Rate limiting: 10 messages/sec (100ms)
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n================================================================');
  console.log('BROADCAST CAMPAIGN COMPLETED');
  console.log(`Successfully sent: ${sent} | Failed: ${failed}`);
  console.log('================================================================\n');

  await mongoose.disconnect();
}

broadcastRichRoyal().catch(err => {
  console.error('Fatal broadcast error:', err);
  process.exit(1);
});
