import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function broadcastJamnagar() {
  const isExecute = process.argv.includes('--execute');

  console.log('================================================================');
  console.log(`JAMNAGAR COUPLES SHOW BROADCAST — ${isExecute ? '🔴 LIVE DISPATCH' : '🟡 DRY RUN / ESTIMATE'}`);
  console.log('================================================================');

  const csvPath = path.resolve(process.cwd(), '../CSV/EK DUJE KE LIYE-Replies-9-9-2026 23-01.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at:', csvPath);
    process.exit(1);
  }

  // 1. Check template status on Meta
  const wabaId = env.WHATSAPP_WABA_ID;
  const statusUrl = `https://graph.facebook.com/v26.0/${wabaId}/message_templates?name=edkl_jamnagar_couples_show_v1`;
  const statusRes = await fetch(statusUrl, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
  });
  const statusData = await statusRes.json();
  const metaTemplate = statusData.data?.[0];

  console.log(`Meta Template: edkl_jamnagar_couples_show_v1`);
  console.log(`Status: ${metaTemplate?.status || 'NOT FOUND'} (Lang: ${metaTemplate?.language || 'gu'})`);

  if (isExecute && metaTemplate?.status !== 'APPROVED') {
    console.error('\n❌ Cannot dispatch: Template is not yet APPROVED by Meta.');
    process.exit(1);
  }

  // 2. Connect to database for ledger & duplicate protection
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
    const wifeName = parts[4]?.replace(/^"|"$/g, '').trim();

    if (phone.length > 10) phone = phone.slice(-10);

    if (!phone || phone.length !== 10 || /^0{10}$/.test(phone) || /^1{10}$/.test(phone)) {
      invalidCount++;
    } else {
      if (!phoneMap.has(phone)) {
        phoneMap.set(phone, { name, wifeName, countryCode, phone });
      }
    }
  });

  const uniqueRecipients = Array.from(phoneMap.values());
  const metaRateBase = 0.8631; // INR per marketing message
  const metaRateGst = 1.0185; // INR per marketing message with 18% GST
  const estimatedCostBase = (uniqueRecipients.length * metaRateBase).toFixed(2);
  const estimatedCostGst = (uniqueRecipients.length * metaRateGst).toFixed(2);

  console.log(`\nAudience Summary:`);
  console.log(`- Total CSV Rows: ${rows.length}`);
  console.log(`- Invalid Phone Numbers Excluded: ${invalidCount}`);
  console.log(`- Unique Valid Recipients: ${uniqueRecipients.length}`);
  console.log(`\nEstimated Meta Cost (India Marketing Message):`);
  console.log(`- Base Meta Cost (@ ₹0.8631/msg): ₹${estimatedCostBase}`);
  console.log(`- Total Cost with 18% GST (@ ~₹1.0185/msg): ₹${estimatedCostGst}`);

  if (!isExecute) {
    console.log('\n🟡 DRY RUN COMPLETE. Zero WhatsApp messages were sent.');
    console.log('To execute live broadcast after approval, run:');
    console.log('  node scripts/broadcast_jamnagar_show.js --execute');
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    return;
  }

  // 4. Check already sent messages to prevent any duplicate dispatch
  const sentSet = new Set();
  if (db) {
    const existing = await db.collection('whatsapp_messages').find({
      templateName: 'edkl_jamnagar_couples_show_v1',
      status: { $in: ['SENT', 'DELIVERED', 'READ'] }
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
            name: 'edkl_jamnagar_couples_show_v1',
            language: {
              code: metaTemplate.language || 'gu'
            }
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
            content: bodyText,
            contentType: 'template',
            templateName: 'edkl_jamnagar_couples_show_v1',
            templateLanguage: metaTemplate.language || 'gu',
            templateCategory: 'MARKETING',
            trigger: 'marketing_broadcast',
            providerMode: 'META',
            idempotencyKey: `JAMNAGAR_MKT_${rec.phone}`,
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

  console.log('\n================================================================');
  console.log(`BROADCAST COMPLETE! Sent: ${sent} | Failed: ${failed}`);
  console.log('================================================================');

  // Save audit log
  try {
    const logDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, `jamnagar_broadcast_report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(logPath, JSON.stringify({
      campaign: 'edkl_jamnagar_couples_show_v1',
      completedAt: new Date().toISOString(),
      totalAudience: uniqueRecipients.length,
      sent,
      failed,
      dispatchLogs
    }, null, 2));
    console.log(`Audit report saved to: ${logPath}`);
  } catch (err) {
    console.warn('Could not save local audit log:', err.message);
  }

  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

broadcastJamnagar().catch(err => {
  console.error('Fatal broadcast error:', err);
  process.exit(1);
});
