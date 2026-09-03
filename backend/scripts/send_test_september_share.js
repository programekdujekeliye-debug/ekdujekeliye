import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import mongoose from 'mongoose';
import { sendUtilityTemplate } from '../src/integrations/whatsapp/whatsapp.service.js';
import { env, getMetaGraphApiUrl } from '../src/config/env.js';

const prodUri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function sendTestMessage() {
  console.log('====================================================');
  console.log('WHATSAPP TEST SENDER: September 7 & 11 Gift & Share');
  console.log('====================================================');

  await mongoose.connect(prodUri, { family: 4 });

  try {
    // 1. Check template status on Meta
    const statusUrl = getMetaGraphApiUrl(`${env.WHATSAPP_WABA_ID}/message_templates?name=edkl_september_gift_share_v2`);
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
    });
    const statusData = await statusRes.json();
    const templates = statusData.data || [];

    console.log(`Found ${templates.length} template language variant(s) on Meta:`);
    templates.forEach(t => {
      console.log(`- Lang: ${t.language} | Status: ${t.status} | ID: ${t.id}`);
    });

    const approvedTemplate = templates.find(t => t.status === 'APPROVED');

    if (!approvedTemplate) {
      console.log(`\n⏳ [STATUS: PENDING] Meta automated review is in progress.`);
      console.log(`Meta usually reviews marketing templates within 1 - 10 minutes.`);
      console.log(`As soon as status changes to APPROVED, run this script to dispatch the test message to +918320594829!`);
      return;
    }

    const testRecipient = process.argv[2] ? process.argv[2].replace(/\D/g, '') : '919724232835';
    const coupleName = process.argv[3] || 'Manish and Shital';
    console.log(`\n✅ Template is APPROVED under language: ${approvedTemplate.language}!`);
    console.log(`Dispatching test personalized message with name "${coupleName}" to: +${testRecipient}...`);

    const result = await sendUtilityTemplate({
      recipientPhone: testRecipient,
      templateKey: 'edkl_september_gift_share_v2',
      languageCode: approvedTemplate.language,
      variables: {
        customerName: coupleName
      },
      idempotencyKey: `MKT_TEST_${Date.now()}`,
      trigger: 'marketing_test',
      category: 'MARKETING'
    });

    console.log('\nSend Result:', JSON.stringify(result, null, 2));
    if (result.success) {
      console.log(`\n🎉 TEST MESSAGE SENT SUCCESSFULLY TO +${testRecipient}!`);
    } else {
      console.warn(`\n⚠️ Message dispatch error:`, result.error);
    }
  } finally {
    await mongoose.disconnect();
  }
}

sendTestMessage().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
