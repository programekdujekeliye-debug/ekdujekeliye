import { env } from '../src/config/env.js';

async function inspectTemplates() {
  console.log('====================================================');
  console.log('META WHATSAPP MESSAGE TEMPLATES INSPECTION');
  console.log('====================================================');
  console.log(`WABA ID Configured: ${env.WHATSAPP_WABA_ID || '(Not configured)'}`);
  console.log(`Phone Number ID: ${env.WHATSAPP_PHONE_NUMBER_ID}`);
  console.log(`Access Token: ${env.WHATSAPP_ACCESS_TOKEN ? 'YES' : 'NO'}`);

  if (!env.WHATSAPP_ACCESS_TOKEN) {
    console.log('❌ WHATSAPP_ACCESS_TOKEN missing.');
    return;
  }

  // If WABA ID is present, fetch templates
  const wabaId = env.WHATSAPP_WABA_ID || '1177696470877995'; // Or discover from phone number
  console.log(`\nQuerying Meta Graph API for WABA ID: ${wabaId}...`);

  try {
    const url = `https://graph.facebook.com/v25.0/${wabaId}/message_templates?fields=name,status,category,language,components`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`
      }
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      console.log(`⚠️ Meta API Template Query Result: ${data.error?.message || res.statusText}`);
      console.log('Error details:', JSON.stringify(data.error, null, 2));
      return;
    }

    const templates = data.data || [];
    console.log(`\n✓ Total Templates Found in Meta: ${templates.length}\n`);

    templates.forEach((t, i) => {
      console.log(`[${i + 1}] Name: "${t.name}" | Status: ${t.status} | Category: ${t.category} | Lang: ${t.language}`);
      if (t.components) {
        t.components.forEach(c => {
          if (c.type === 'BODY') {
            console.log(`    Body Text: "${c.text}"`);
          }
        });
      }
      console.log('----------------------------------------------------');
    });
  } catch (err) {
    console.error('Error fetching templates:', err.message);
  }
}

inspectTemplates().catch(console.error);
