import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import mongoose from 'mongoose';
import { sendUtilityTemplate } from '../src/integrations/whatsapp/whatsapp.service.js';
import { env, getMetaGraphApiUrl } from '../src/config/env.js';

const prodUri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function sendTest() {
  console.log('--- Checking Template Status before sending test message ---');
  await mongoose.connect(prodUri, { family: 4 });

  try {
    const statusUrl = getMetaGraphApiUrl(`${env.WHATSAPP_WABA_ID}/message_templates?name=edkl_all_couples_invite_v1`);
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
    });
    const statusData = await statusRes.json();
    const metaTemplate = statusData.data?.[0];

    console.log(`Meta Status: ${metaTemplate?.status || 'NOT_FOUND'}`);

    if (metaTemplate?.status !== 'APPROVED') {
      console.log(`[WAIT] Template status is currently '${metaTemplate?.status}'. Meta review is in progress.`);
      return;
    }

    console.log('\n--- Template is APPROVED! Sending Test Message to +918320594829 ---');
    const result = await sendUtilityTemplate({
      recipientPhone: '918320594829',
      templateKey: 'edkl_all_couples_invite_v1',
      languageCode: 'en_US',
      variables: {
        customerName: 'Jayneshbhai'
      },
      trigger: 'marketing_test',
      category: 'MARKETING'
    });

    console.log('Send Result:', result);
  } finally {
    await mongoose.disconnect();
  }
}

sendTest().catch(err => {
  console.error('Error sending test:', err);
  process.exit(1);
});
