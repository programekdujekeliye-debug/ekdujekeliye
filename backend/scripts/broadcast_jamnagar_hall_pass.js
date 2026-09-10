import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function broadcastJamnagarHallPass() {
  const isExecute = process.argv.includes('--execute');
  const isAll = process.argv.includes('--all'); // if not specified, default can be paid-only or all based on flag
  const isPaidOnly = process.argv.includes('--paid-only') || (!isAll);

  console.log('================================================================');
  console.log(`JAMNAGAR HALL PASS BROADCAST — ${isExecute ? '🔴 LIVE DISPATCH' : '🟡 DRY RUN / ESTIMATE'}`);
  console.log(`Filter Mode: ${isPaidOnly ? 'PAID COUPLE PASS ONLY (208)' : 'ALL CSV CONTACTS (470)'}`);
  console.log('================================================================');

  const csvPath = path.resolve(process.cwd(), '../CSV/EK DUJE KE LIYE-Replies-10-9-2026 19-55.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at:', csvPath);
    process.exit(1);
  }

  // 1. Check template status on Meta
  const templateName = 'edkl_jamnagar_hall_pass_v1';
  const wabaId = env.WHATSAPP_WABA_ID;
  const statusUrl = `https://graph.facebook.com/v26.0/${wabaId}/message_templates?name=${templateName}`;
  const statusRes = await fetch(statusUrl, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
  });
  const statusData = await statusRes.json();
  const metaTemplate = statusData.data?.[0];

  console.log(`Meta Template: ${templateName}`);
  console.log(`Status: ${metaTemplate?.status || 'NOT FOUND'} (Category: ${metaTemplate?.category || 'N/A'}, Lang: ${metaTemplate?.language || 'gu'})`);

  if (isExecute && metaTemplate?.status !== 'APPROVED') {
    console.error('\n❌ Cannot dispatch: Template is not yet APPROVED by Meta.');
    process.exit(1);
  }

  // 2. Connect to DB for logging
  const dbUri = env.PROD_MONGO_URI || env.MONGO_URI;
  let db = null;
  try {
    await mongoose.connect(dbUri, { family: 4 });
    db = mongoose.connection.db;
    console.log(`Connected to database: ${mongoose.connection.name}`);
  } catch (err) {
    console.warn(`Database connection note: ${err.message}. Proceeding with file-based audit.`);
  }

  // 3. Parse CSV
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const rows = lines.slice(1);

  const phoneMap = new Map();
  let invalidCount = 0;

  rows.forEach((row) => {
    const parts = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        parts.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    parts.push(cur);

    const name = parts[0]?.replace(/^"|"$/g, '').trim();
    const countryCode = parts[1]?.replace(/^"|"$/g, '').trim() || '91';
    let phone = parts[2]?.replace(/^"|"$/g, '').trim().replace(/\D/g, '');
    const partnerName = parts[4]?.replace(/^"|"$/g, '').trim();
    const ticketName = parts[8]?.replace(/^"|"$/g, '').trim();
    const ticketId = parts[9]?.replace(/^"|"$/g, '').trim();

    if (phone.length > 10) phone = phone.slice(-10);

    const isPaid = ticketName && ticketName !== 'N/A';

    if (!phone || phone.length !== 10 || /^0{10}$/.test(phone) || /^1{10}$/.test(phone)) {
      invalidCount++;
    } else {
      if (isPaidOnly && !isPaid) {
        // Skip unpaid if paid-only
        return;
      }
      if (!phoneMap.has(phone)) {
        phoneMap.set(phone, { name: name || 'મિત્ર', partnerName, countryCode, phone, ticketName, ticketId, isPaid });
      }
    }
  });

  const uniqueRecipients = Array.from(phoneMap.values());
  const utilityRateBase = 0.12; // INR per utility message
  const utilityRateGst = 0.1416; // INR with 18% GST
  const marketingRateBase = 0.8631; // INR per marketing message
  const marketingRateGst = 1.0185; // INR with 18% GST

  const estUtilBase = (uniqueRecipients.length * utilityRateBase).toFixed(2);
  const estUtilGst = (uniqueRecipients.length * utilityRateGst).toFixed(2);
  const estMktBase = (uniqueRecipients.length * marketingRateBase).toFixed(2);
  const estMktGst = (uniqueRecipients.length * marketingRateGst).toFixed(2);

  console.log(`\nAudience Summary:`);
  console.log(`- Total CSV Data Rows: ${rows.length}`);
  console.log(`- Invalid Phone Numbers: ${invalidCount}`);
  console.log(`- Target Unique Recipients: ${uniqueRecipients.length}`);
  console.log(`\nEstimated Meta Cost:`);
  console.log(`- UTILITY Rate: ₹${estUtilBase} (Base) | ₹${estUtilGst} (with 18% GST)`);
  console.log(`- MARKETING Rate (if recategorized): ₹${estMktBase} (Base) | ₹${estMktGst} (with 18% GST)`);

  if (!isExecute) {
    console.log('\n🟡 DRY RUN COMPLETE. No messages sent.');
    console.log('To execute live dispatch, run with: node scripts/broadcast_jamnagar_hall_pass.js --execute [--all | --paid-only]');
    process.exit(0);
  }

  // 4. Duplicate Check from DB
  const sentSet = new Set();
  if (db) {
    const existing = await db.collection('whatsapp_messages').find({
      templateName,
      status: 'SENT'
    }, { projection: { recipientPhone: 1 } }).toArray();

    existing.forEach(m => {
      const p = String(m.recipientPhone || '').slice(-10);
      if (p) sentSet.add(p);
    });
    console.log(`Already sent: ${sentSet.size} recipients.`);
  }

  const pendingRecipients = uniqueRecipients.filter(r => !sentSet.has(r.phone));
  console.log(`Remaining recipients to broadcast: ${pendingRecipients.length}`);

  // 5. Live Dispatch
  console.log(`\n🔴 STARTING LIVE BROADCAST TO ${pendingRecipients.length} RECIPIENTS...`);
  const sendUrl = `https://graph.facebook.com/v26.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  let sent = 0;
  let failed = 0;
  const dispatchLogs = [];

  const bodyText = metaTemplate?.components?.find(c => c.type === 'BODY')?.text || '';

  for (let i = 0; i < pendingRecipients.length; i++) {
    const rec = pendingRecipients[i];
    const fullPhone = `91${rec.phone}`;

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
            language: {
              code: metaTemplate?.language || 'gu'
            },
            components: [
              {
                type: 'body',
                parameters: [
                  {
                    type: 'text',
                    text: (rec.name || 'મિત્ર').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 60) || 'મિત્ર'
                  }
                ]
              }
            ]
          }
        })
      });

      const data = await res.json();

      if (data.messages && data.messages[0]?.id) {
        sent++;
        const wamid = data.messages[0].id;
        dispatchLogs.push({ phone: rec.phone, name: rec.name, status: 'SENT', wamid });

        if (db) {
          await db.collection('whatsapp_messages').insertOne({
            messageId: wamid,
            providerMessageId: wamid,
            direction: 'OUTBOUND',
            recipientPhone: fullPhone,
            recipientMasked: `${rec.phone.slice(0, 2)}******${rec.phone.slice(-2)}`,
            content: bodyText.replace('{{1}}', rec.name || 'મિત્ર'),
            contentType: 'template',
            templateName,
            templateLanguage: metaTemplate?.language || 'gu',
            templateCategory: metaTemplate?.category || 'UTILITY',
            trigger: 'jamnagar_hall_pass_broadcast',
            providerMode: 'META',
            idempotencyKey: `JAMNAGAR_HALL_PASS_${rec.phone}`,
            status: 'SENT',
            sentAt: new Date(),
            createdAt: new Date()
          }).catch(() => {});
        }
      } else {
        failed++;
        console.warn(`[FAIL] ${rec.phone} (${rec.name}):`, data.error?.message || 'Error');
        dispatchLogs.push({ phone: rec.phone, name: rec.name, status: 'FAILED', error: data.error?.message });
      }
    } catch (e) {
      failed++;
      console.error(`[ERROR] ${rec.phone}:`, e.message);
      dispatchLogs.push({ phone: rec.phone, name: rec.name, status: 'ERROR', error: e.message });
    }

    if ((i + 1) % 25 === 0 || i === pendingRecipients.length - 1) {
      const pct = (((i + 1) / pendingRecipients.length) * 100).toFixed(1);
      const now = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' });
      console.log(`[${now} IST] Progress: [${i + 1}/${pendingRecipients.length}] (${pct}%) | Sent: ${sent} | Failed: ${failed}`);
    }

    // Rate limiting: 100ms
    await new Promise(r => setTimeout(r, 100));
  }

  // Save report
  const reportPath = path.resolve(process.cwd(), `backups/jamnagar_hall_pass_report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTargeted: pendingRecipients.length,
    sent,
    failed,
    logs: dispatchLogs
  }, null, 2));

  console.log('\n================================================================');
  console.log('JAMNAGAR HALL PASS BROADCAST COMPLETED');
  console.log(`- Successfully Sent: ${sent}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Audit Log saved: ${reportPath}`);
  console.log('================================================================');

  if (db) await mongoose.disconnect();
  process.exit(0);
}

broadcastJamnagarHallPass().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
