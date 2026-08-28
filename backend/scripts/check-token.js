import { env } from '../src/config/env.js';

async function checkTokenWabas() {
  console.log('Inspecting access token associated WABAs and businesses...');
  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/debug_token?input_token=${env.WHATSAPP_ACCESS_TOKEN}&access_token=${env.WHATSAPP_ACCESS_TOKEN}`);
    const data = await res.json();
    console.log('Debug token info:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

checkTokenWabas().catch(console.error);
