import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function retryRemaining() {
  const isExecute = process.argv.includes('--execute');

  const csvPath = path.resolve(process.cwd(), '../CSV/EK DUJE KE LIYE-Replies-10-9-2026 19-55.csv');
  const templateName = 'edkl_jamnagar_hall_pass_v1';

  // 1. Connect DB
  const dbUri = env.PROD_MONGO_URI || env.MONGO_URI;
  await mongoose.connect(dbUri, { family: 4 });
  const db = mongoose.connection.db;

  // 2. Collect all sent phones from DB & reports
  const sentPhones = new Set();
  const dbSent = await db.collection('whatsapp_messages').find({
    templateName,
    status: 'SENT'
  }, { projection: { recipientPhone: 1 } }).toArray();

  dbSent.forEach(m => {
    const p = String(m.recipientPhone || '').slice(-10);
    if (p) sentPhones.add(p);
  });

  const reportDir = path.resolve(process.cwd(), 'backups');
  if (fs.existsSync(reportDir)) {
    const reports = fs.readdirSync(reportDir).filter(f => f.startsWith('jamnagar_hall_pass_report'));
    reports.forEach(rf => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(reportDir, rf), 'utf8'));
        (data.logs || []).forEach(l => {
          if (l.status === 'SENT' && l.phone) {
            sentPhones.add(String(l.phone).slice(-10));
          }
        });
      } catch (_) {}
    });
  }

  // 3. Read CSV
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0).slice(1);
  const csvRecipients = new Map();

  lines.forEach(row => {
    const parts = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) {
        parts.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    parts.push(cur);

    const name = parts[0]?.replace(/^"|"$/g, '').trim();
    let phone = parts[2]?.replace(/^"|"$/g, '').trim().replace(/\D/g, '');
    if (phone.length > 10) phone = phone.slice(-10);

    if (phone && phone.length === 10 && !/^0{10}$/.test(phone)) {
      if (!csvRecipients.has(phone)) {
        csvRecipients.set(phone, { name: name || 'મિત્ર', phone });
      }
    }
  });

  const pending = [];
  csvRecipients.forEach((rec, phone) => {
    if (!sentPhones.has(phone)) {
      pending.push(rec);
    }
  });

  console.log('================================================================');
  console.log(`JAMNAGAR HALL PASS RETRY DISPATCH — ${isExecute ? '🔴 LIVE EXECUTION' : '🟡 DRY RUN'}`);
  console.log('================================================================');
  console.log(`Total CSV Contacts: ${csvRecipients.size}`);
  console.log(`Already Successfully Sent: ${sentPhones.size}`);
  console.log(`Remaining to Send: ${pending.length}`);

  if (pending.length === 0) {
    console.log('\n✅ ALL CONTACTS HAVE ALREADY RECEIVED THE MESSAGE! Nothing remaining.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('\nPending recipients:');
  pending.forEach((p, idx) => console.log(`  ${idx + 1}. ${p.phone} - ${p.name}`));

  if (!isExecute) {
    console.log('\nRun with --execute to send to these remaining recipients.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Live dispatch to pending
  const sendUrl = `https://graph.facebook.com/v26.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i++) {
    const rec = pending[i];
    const fullPhone = `91${rec.phone}`;
    const cleanName = (rec.name || 'મિત્ર').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 60) || 'મિત્ર';

    try {
      const res = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: fullPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'gu' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: cleanName }]
              }
            ]
          }
        })
      });

      const data = await res.json();
      if (data.messages && data.messages[0]?.id) {
        sent++;
        const wamid = data.messages[0].id;
        console.log(`✓ [${i + 1}/${pending.length}] Sent to ${rec.phone} (${cleanName}) - ${wamid}`);
        await db.collection('whatsapp_messages').insertOne({
          messageId: wamid,
          providerMessageId: wamid,
          direction: 'OUTBOUND',
          recipientPhone: fullPhone,
          recipientMasked: `${rec.phone.slice(0, 2)}******${rec.phone.slice(-2)}`,
          contentType: 'template',
          templateName,
          templateLanguage: 'gu',
          templateCategory: 'UTILITY',
          trigger: 'jamnagar_hall_pass_broadcast_retry',
          providerMode: 'META',
          idempotencyKey: `JAMNAGAR_HALL_PASS_RETRY_${rec.phone}`,
          status: 'SENT',
          sentAt: new Date(),
          createdAt: new Date()
        }).catch(() => {});
      } else {
        failed++;
        console.warn(`✗ [${i + 1}/${pending.length}] Failed for ${rec.phone}:`, data.error?.message);
      }
    } catch (e) {
      failed++;
      console.error(`✗ [${i + 1}/${pending.length}] Error for ${rec.phone}:`, e.message);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n================================================================');
  console.log(`RETRY COMPLETE: ${sent} sent, ${failed} failed.`);
  console.log(`Total Sent Overall: ${sentPhones.size + sent} / ${csvRecipients.size}`);
  console.log('================================================================');

  await mongoose.disconnect();
  process.exit(0);
}

retryRemaining().catch(console.error);
