import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function testJamnagarShow() {
  console.log('====================================================');
  console.log('WHATSAPP TEST SENDER: Jamnagar Couples Show');
  console.log('====================================================');

  const wabaId = env.WHATSAPP_WABA_ID;
  const statusUrl = `https://graph.facebook.com/v26.0/${wabaId}/message_templates?name=edkl_jamnagar_couples_show_v1`;
  const statusRes = await fetch(statusUrl, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
  });
  const statusData = await statusRes.json();
  const metaTemplate = statusData.data?.[0];

  console.log('Meta Template Details:');
  console.log(`- ID: ${metaTemplate?.id}`);
  console.log(`- Name: ${metaTemplate?.name}`);
  console.log(`- Status: ${metaTemplate?.status}`);
  console.log(`- Language: ${metaTemplate?.language}`);
  console.log(`- Category: ${metaTemplate?.category}`);

  if (metaTemplate?.status !== 'APPROVED') {
    console.log(`\n⏳ Template status is currently '${metaTemplate?.status || 'NOT_FOUND'}'.`);
    console.log('Meta automated review is in progress (typically 1 to 5 minutes).');
    return false;
  }

  const recipient = process.argv[2] ? process.argv[2].replace(/\D/g, '') : '918320594829';
  const finalPhone = recipient.startsWith('91') ? recipient : `91${recipient}`;

  console.log(`\n✅ Template is APPROVED! Sending test message directly to +${finalPhone}...`);

  const sendUrl = `https://graph.facebook.com/v26.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const sendRes = await fetch(sendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: finalPhone,
      type: 'template',
      template: {
        name: 'edkl_jamnagar_couples_show_v1',
        language: {
          code: metaTemplate.language || 'gu'
        }
      }
    })
  });

  const sendData = await sendRes.json();
  console.log('\nMeta API Direct Dispatch Response:');
  console.log(JSON.stringify(sendData, null, 2));

  if (sendData.messages && sendData.messages[0]?.id) {
    const wamid = sendData.messages[0].id;
    console.log(`\n🎉 TEST MESSAGE DISPATCHED SUCCESSFULLY TO +${finalPhone}!`);
    console.log(`WAMID: ${wamid}`);
    return true;
  } else {
    console.warn(`\n⚠️ Dispatch error:`, sendData.error?.message || 'Unknown error');
    return false;
  }
}

testJamnagarShow().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
