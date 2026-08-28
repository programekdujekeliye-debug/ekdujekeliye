import { env } from '../src/config/env.js';

async function submitCompliantTemplate() {
  const wabaId = env.WHATSAPP_WABA_ID || '1370234778036017';
  console.log(`Submitting compliant utility template to Meta WABA ${wabaId}...`);

  const payload = {
    name: 'ekduje_registration_pass',
    category: 'UTILITY',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Registration Confirmed'
      },
      {
        type: 'BODY',
        text: 'Hi {{1}},\n\nThank you for registering for {{2}}. Your booking reference is {{3}}.\n\nDate: {{4}}\nTime: {{5}}\nVenue: {{6}}\n\nYour entry pass and QR code are ready.',
        example: {
          body_text: [
            [
              'Jaynesh Patel',
              'Ek Duje Ke Liye Seminar',
              'EK06-02',
              '25 Oct 2026',
              '8:30 PM',
              'Sardar Smruti Bhavan, Surat'
            ]
          ]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'View Entry Pass',
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
    console.error('Error submitting compliant template:', e.message);
  }
}

submitCompliantTemplate().catch(console.error);
