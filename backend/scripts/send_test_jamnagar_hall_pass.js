import { env } from '../src/config/env.js';

async function sendTestJamnagarHallPass() {
  const recipient = process.argv[2] || env.WHATSAPP_TEST_RECIPIENTS?.[0] || '918320594829';
  const testName = process.argv[3] || 'ટેસ્ટ યુઝર';
  
  const cleanPhone = recipient.replace(/\D/g, '');
  const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  console.log('====================================================');
  console.log('SENDING TEST JAMNAGAR HALL PASS MESSAGE');
  console.log('====================================================');
  console.log(`Recipient: ${fullPhone}`);
  console.log(`Name variable {{1}}: ${testName}`);
  console.log(`Template: edkl_jamnagar_hall_pass_v1 (gu)`);
  console.log('====================================================\n');

  // Check template status first
  const wabaId = env.WHATSAPP_WABA_ID;
  const statusRes = await fetch(`https://graph.facebook.com/v26.0/${wabaId}/message_templates?name=edkl_jamnagar_hall_pass_v1`, {
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
  });
  const statusData = await statusRes.json();
  const template = statusData.data?.[0];

  console.log(`Template Status on Meta: ${template?.status || 'NOT FOUND'}`);
  if (template?.status !== 'APPROVED') {
    console.error(`❌ Template is not approved yet (Current status: ${template?.status}). Cannot send.`);
    process.exit(1);
  }

  const sendUrl = `https://graph.facebook.com/v26.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: fullPhone,
    type: 'template',
    template: {
      name: 'edkl_jamnagar_hall_pass_v1',
      language: {
        code: 'gu'
      },
      components: [
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "text": testName
            }
          ]
        }
      ]
    }
  };

  try {
    const res = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Meta API Response:\n', JSON.stringify(data, null, 2));

    if (data.messages && data.messages[0]?.id) {
      console.log(`\n✅ TEST MESSAGE SENT SUCCESSFULLY!`);
      console.log(`WAMID: ${data.messages[0].id}`);
    } else {
      console.error(`\n❌ FAILED TO SEND:`, data.error?.message || 'Unknown error');
    }
  } catch (e) {
    console.error('Error sending message:', e.message);
  }
}

sendTestJamnagarHallPass().catch(console.error);
