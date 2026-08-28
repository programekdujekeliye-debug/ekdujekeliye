import { env } from '../src/config/env.js';

async function createButtonTemplate() {
  const wabaId = env.WHATSAPP_WABA_ID || '1370234778036017';
  console.log(`Submitting clean utility template with URL button to Meta WABA ${wabaId}...`);

  const payload = {
    name: 'edkl_payment_confirmed_v1',
    category: 'UTILITY',
    language: 'en_US',
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nYour registration for {{2}} is confirmed!\n\nDate: {{3}}\nTime: {{4}}\nVenue: {{5}}\nInquiry ID: {{6}}\n\nPlease click below to access your digital pass and entry QR code.\n\nThank you,\nEk Duje Ke Liye',
        example: {
          body_text: [
            [
              'Jaynesh & Pooja',
              'Ek Duje Ke Liye Seminar',
              '25 Oct 2026',
              '8:30 PM',
              'Sardar Smruti Bhavan, Surat',
              'EK06-02'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Digital Pass',
            url: 'https://www.ekdujekeliye.in/pass/{{1}}',
            example: ['EK06-02']
          }
        ]
      }
    ]
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Meta API Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

createButtonTemplate().catch(console.error);
