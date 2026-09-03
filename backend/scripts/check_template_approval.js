import { env } from '../src/config/env.js';

async function checkStatus() {
  const wabaId = env.WHATSAPP_WABA_ID;
  const url = `https://graph.facebook.com/v25.0/${wabaId}/message_templates?name=edkl_september_gift_share_v2`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
    }
  });
  const data = await res.json();
  console.log('Template status from Meta:');
  if (data.data && data.data.length > 0) {
    data.data.forEach(t => {
      console.log(`- Name: ${t.name} | Lang: ${t.language} | Status: ${t.status} | ID: ${t.id}`);
    });
  } else {
    console.log('Not found or pending:', data);
  }
}

checkStatus().catch(console.error);
