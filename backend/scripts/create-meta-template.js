import { env } from '../src/config/env.js';

async function createTemplate() {
  const wabaId = env.WHATSAPP_WABA_ID || '1370234778036017';
  console.log(`Attempting to submit template 'payment_confirmed_pass' to Meta WABA ${wabaId}...`);

  const payload = {
    name: 'payment_confirmed_pass',
    category: 'UTILITY',
    language: 'gu',
    components: [
      {
        type: 'BODY',
        text: 'નમસ્તે {{1}},\n\nતમારી "એક દુજે કે લિયે" સેમિનારની નોંધણી સફળતાપૂર્વક કન્ફર્મ થઈ ગઈ છે!\n\nકાર્યક્રમ: {{2}}\nતારીખ: {{3}}\nસમય: {{4}}\nસ્થળ: {{5}}\nટોકન નંબર: {{6}}\n\nતમારો ડિજિટલ એન્ટ્રી પાસ અને QR કોડ નીચેની લિંક પરથી મેળવો:\n{{7}}\n\nઆભાર,\nટીમ એક દુજે કે લિયે',
        example: {
          body_text: [
            [
              'જયનેશ પટેલ',
              'એક દુજે કે લિયે સેમિનાર',
              '2026-10-25',
              '8:30 PM',
              'સરદાર સ્મૃતિ ભવન, સુરત',
              'EK06-02',
              'https://www.ekdujekeliye.in/pass/EK06-02'
            ]
          ]
        }
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
    console.error('Error submitting template:', e.message);
  }
}

createTemplate().catch(console.error);
