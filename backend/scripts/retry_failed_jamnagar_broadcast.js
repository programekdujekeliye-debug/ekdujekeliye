import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function retryFailed() {
  const isExecute = process.argv.includes('--execute');
  const retryAll = process.argv.includes('--all'); // retry all 100 or only 131049 & 130472

  console.log('================================================================');
  console.log(`RETRY FAILED BROADCAST MESSAGES — ${isExecute ? '🔴 LIVE RETRY' : '🟡 DRY RUN'}`);
  console.log('================================================================');

  const dbUri = env.PROD_MONGO_URI || env.MONGO_URI;
  await mongoose.connect(dbUri, { family: 4 });
  const db = mongoose.connection.db;

  const failedQuery = {
    templateName: 'edkl_jamnagar_couples_show_v1',
    status: 'FAILED'
  };

  if (!retryAll) {
    // By default exclude 131026 (numbers without WhatsApp)
    failedQuery.lastErrorCode = { $in: ['131049', '130472'] };
  }

  const failedMessages = await db.collection('whatsapp_messages').find(failedQuery).toArray();
  console.log(`Found ${failedMessages.length} candidate failed messages to retry.`);

  const errorBreakdown = {};
  failedMessages.forEach(m => {
    const code = m.lastErrorCode || 'UNKNOWN';
    errorBreakdown[code] = (errorBreakdown[code] || 0) + 1;
  });
  console.log('Error Breakdown of candidates to retry:', errorBreakdown);

  if (!isExecute) {
    console.log('\n🟡 DRY RUN COMPLETE. Zero messages were retried.');
    console.log('To execute live retry:');
    console.log('  node scripts/retry_failed_jamnagar_broadcast.js --execute');
    console.log('To include numbers without WhatsApp (131026) as well:');
    console.log('  node scripts/retry_failed_jamnagar_broadcast.js --execute --all');
    await mongoose.disconnect();
    return;
  }

  console.log(`\n🔴 ATTEMPTING LIVE RETRY FOR ${failedMessages.length} RECIPIENTS...`);
  const sendUrl = `https://graph.facebook.com/v26.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < failedMessages.length; i++) {
    const m = failedMessages[i];
    const phone = m.recipientPhone;

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
          to: phone,
          type: 'template',
          template: {
            name: 'edkl_jamnagar_couples_show_v1',
            language: { code: 'gu' }
          }
        })
      });

      const data = await res.json();

      if (data.messages && data.messages[0]?.id) {
        successCount++;
        const newWamid = data.messages[0].id;
        // Update the record in db with new wamid and mark SENDING / SENT
        await db.collection('whatsapp_messages').updateOne(
          { _id: m._id },
          {
            $set: {
              messageId: newWamid,
              providerMessageId: newWamid,
              status: 'SENT',
              lastErrorCode: null,
              lastErrorMessage: null,
              sentAt: new Date(),
              updatedAt: new Date(),
              retriedAt: new Date()
            },
            $inc: { retryCount: 1 }
          }
        );
      } else {
        failCount++;
        console.warn(`[RETRY FAIL] ${phone}:`, data.error?.message);
      }
    } catch (e) {
      failCount++;
      console.error(`[RETRY ERROR] ${phone}:`, e.message);
    }

    if ((i + 1) % 20 === 0 || i === failedMessages.length - 1) {
      console.log(`Retry progress: [${i + 1}/${failedMessages.length}] | Sent to Meta: ${successCount} | Failed: ${failCount}`);
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n================================================================');
  console.log(`RETRY DISPATCH COMPLETE! Sent to Meta: ${successCount} | Failed: ${failCount}`);
  console.log('================================================================');

  await mongoose.disconnect();
}

retryFailed().catch(console.error);
