import { env } from '../src/config/env.js';

async function checkAllTemplates() {
  const wabaId = env.WHATSAPP_WABA_ID || '1370234778036017';
  console.log(`Checking all message templates on WABA ID: ${wabaId}...`);

  const url = `https://graph.facebook.com/v25.0/${wabaId}/message_templates?limit=100&fields=name,status,category,language,components,id`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
    });
    const data = await res.json();
    if (data.error) {
      console.log('Error:', data.error.message);
      return;
    }
    console.log(`Found ${data.data?.length || 0} total template records.`);
    (data.data || []).forEach(t => {
      console.log(`- Template: "${t.name}" | Status: ${t.status} | Category: ${t.category} | Lang: ${t.language} | ID: ${t.id}`);
    });
  } catch (e) {
    console.error(e);
  }
}

checkAllTemplates().catch(console.error);
