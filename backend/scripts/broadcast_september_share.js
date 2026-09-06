import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { env, getMetaGraphApiUrl } from '../src/config/env.js';
import { sendUtilityTemplate } from '../src/integrations/whatsapp/whatsapp.service.js';

const prodUri = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

async function runBroadcast() {
  const isLive = process.argv.includes('--live');
  const isExecute = process.argv.includes('--execute');

  if (isLive) {
    env.APP_ENV = 'production';
    env.WHATSAPP_MODE = 'production';
  }

  console.log('====================================================');
  console.log(`[SEPTEMBER 7 & 11 BROADCAST] Mode: ${isLive && isExecute ? '🔴 LIVE DISPATCH' : '🟡 DRY RUN / SIMULATION'}`);
  console.log('====================================================');

  await mongoose.connect(prodUri, { family: 4 });
  const db = mongoose.connection.db;

  // 1. Verify template status on Meta
  const statusUrl = getMetaGraphApiUrl(`${env.WHATSAPP_WABA_ID}/message_templates?name=edkl_september_gift_share_v3`);
  const statusRes = await fetch(statusUrl, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
  });
  const statusData = await statusRes.json();
  const templates = statusData.data || [];
  const approvedTemplate = templates.find(t => t.status === 'APPROVED');

  console.log(`Meta Template Variants:`, templates.map(t => `${t.language}: ${t.status}`).join(', ') || 'None found');
  if (!approvedTemplate && isLive && isExecute) {
    console.error('❌ Cannot dispatch broadcast: Template edkl_september_gift_share_v3 is not yet APPROVED by Meta.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const activeLang = approvedTemplate?.language || 'en_US';

  // 2. Query all past attendees who paid/confirmed
  const upcomingIds = ['prog-2026-09-07', 'prog-2026-09-11', 'prog-2026-09-19', 'prog-1787844365699-01'];
  const upcomingDates = ['2026-09-07', '2026-09-11', '2026-09-19'];

  const query = {
    programId: { $nin: upcomingIds },
    programDate: { $nin: upcomingDates },
    inquiryId: { $not: /^(EK06|EK07|EK08)/ },
    isDeleted: { $ne: true },
    whatsappOptOutAt: null,
    $or: [
      { status: 'approved' },
      { 'payment.status': 'captured' }
    ]
  };

  const rawSubmissions = await db.collection('submission').find(query).toArray();
  console.log(`\nFound ${rawSubmissions.length} paid/approved registrations for past events.`);

  // 3. Deduplicate by unique 10-digit mobile number
  const phoneMap = new Map();
  let invalidPhoneCount = 0;

  for (const sub of rawSubmissions) {
    const raw = String(sub.phoneNumber || '').replace(/\D/g, '').slice(-10);
    if (!raw || raw.length !== 10 || /^0{10}$/.test(raw) || /^1{10}$/.test(raw)) {
      invalidPhoneCount++;
      continue;
    }
    if (!phoneMap.has(raw)) {
      phoneMap.set(raw, sub);
    }
  }

  const uniqueRecipients = Array.from(phoneMap.values());
  console.log(`- Invalid/unreachable phones excluded: ${invalidPhoneCount}`);
  console.log(`- Total UNIQUE recipients to broadcast: ${uniqueRecipients.length}`);

  if (!isLive || !isExecute) {
    console.log('\n🟡 DRY RUN COMPLETE. Zero WhatsApp messages were sent.');
    console.log('To execute live broadcast to all unique recipients, run with:');
    console.log('  node scripts/broadcast_september_share.js --live --execute');
    await mongoose.disconnect();
    return;
  }

function formatCoupleName(rec) {
  const h = (rec.husbandName || '').trim();
  const w = (rec.wifeName || '').trim();
  const s = (rec.surname || '').trim();

  const validH = h && h !== 'Partner' && h !== '.' ? h : '';
  const validW = w && w !== 'Partner' && w !== '.' ? w : '';

  let name = '';
  if (validH && validW) {
    name = `${validH} & ${validW}`;
  } else if (validH) {
    name = validH;
  } else if (validW) {
    name = validW;
  }

  if (s && s !== '.') {
    name = name ? `${name} ${s}` : s;
  }

  return name.trim() || 'સ્નેહી મિત્રો';
}

  // --- LIVE BROADCAST ---
  console.log(`\n🔴 STARTING LIVE BROADCAST TO ${uniqueRecipients.length} PAST ATTENDEES...`);
  let sent = 0;
  let failed = 0;
  const dispatchLogs = [];

  for (let i = 0; i < uniqueRecipients.length; i++) {
    const rec = uniqueRecipients[i];
    const phone = String(rec.phoneNumber || '').replace(/\D/g, '').slice(-10);
    const coupleName = formatCoupleName(rec);

    try {
      const res = await sendUtilityTemplate({
        recipientPhone: `91${phone}`,
        templateKey: 'edkl_september_gift_share_v3',
        languageCode: activeLang,
        variables: {
          customerName: coupleName
        },
        idempotencyKey: `MKT_SEP_SHARE_V3:${rec.inquiryId || phone}`,
        trigger: 'marketing_broadcast',
        category: 'MARKETING'
      });

      if (res.success) {
        sent++;
        dispatchLogs.push({ phone, inquiryId: rec.inquiryId, coupleName, status: 'SENT', wamid: res.providerMessageId });
      } else {
        failed++;
        console.warn(`[FAIL] ${phone} (${coupleName}): ${res.error || res.message}`);
        dispatchLogs.push({ phone, inquiryId: rec.inquiryId, coupleName, status: 'FAILED', error: res.error || res.message });
      }
    } catch (e) {
      failed++;
      console.error(`[ERROR] ${phone}: ${e.message}`);
      dispatchLogs.push({ phone, inquiryId: rec.inquiryId, coupleName, status: 'ERROR', error: e.message });
    }

    if ((i + 1) % 50 === 0 || i === uniqueRecipients.length - 1) {
      const pct = (((i + 1) / uniqueRecipients.length) * 100).toFixed(1);
      console.log(`Progress: [${i + 1}/${uniqueRecipients.length}] (${pct}%) - Sent: ${sent}, Failed: ${failed}`);
    }

    // Rate limiting: 100ms
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n====================================================');
  console.log(`BROADCAST COMPLETE! Sent: ${sent}, Failed: ${failed}`);
  console.log('====================================================');

  // Save audit log
  try {
    const logDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, `broadcast_v3_report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(logPath, JSON.stringify({
      campaign: 'edkl_september_gift_share_v3',
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

  await mongoose.disconnect();
}

runBroadcast().catch(err => {
  console.error('Broadcast fatal error:', err);
  process.exit(1);
});
