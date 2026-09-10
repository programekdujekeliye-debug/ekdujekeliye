import { env } from '../src/config/env.js';

async function submitAndCheckUtilityTemplate() {
  const wabaId = env.WHATSAPP_WABA_ID;
  const templateName = 'edkl_jamnagar_hall_pass_v1';
  console.log(`Submitting utility template "${templateName}" to Meta WABA ${wabaId}...`);

  const bodyText = `નમસ્તે {{1}},

તમારું *“એક દૂજે કે લિયે – જામનગર”* કાર્યક્રમ માટેનું રજિસ્ટ્રેશન પૂર્ણ થઈ ગયું છે.

તમારો *Couple Pass હોલ પર જ આપવામાં આવશે*, એટલે અલગથી પાસ લેવા ક્યાંય જવાની જરૂર નથી.

📍 એમ. પી. શાહ ટાઉન હોલ, જામનગર
📅 આજે, 10 સપ્ટેમ્બર 2026
⏰ રાત્રે 8:30 વાગ્યે

બસ જોજો હો, ભૂલાય નહીં 😊
*આજે જ કાર્યક્રમ છે અને હવે આવવાનો સમય થઈ ગયો છે.*

સમયસર હોલ પર આવી જજો.

કોઈ માહિતીની જરૂર હોય તો સંપર્ક કરો:
8320208784 / 9904225313

Ek Duje Ke Liye Team`;

  const payload = {
    name: templateName,
    category: 'UTILITY',
    language: 'gu',
    components: [
      {
        type: 'BODY',
        text: bodyText,
        example: {
          body_text: [
            ['અમિતભાઈ']
          ]
        }
      }
    ]
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v26.0/${wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Meta Submit Response:', JSON.stringify(data, null, 2));

    if (data.id) {
      console.log(`\nTemplate created with ID: ${data.id}. Checking status...`);
      // Wait 3 seconds and poll status
      await new Promise(r => setTimeout(r, 3000));
      const statusRes = await fetch(`https://graph.facebook.com/v26.0/${wabaId}/message_templates?name=${templateName}`, {
        headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
      });
      const statusData = await statusRes.json();
      console.log('Template Status Query:', JSON.stringify(statusData, null, 2));
    }
  } catch (e) {
    console.error('Error submitting template:', e.message);
  }
}

submitAndCheckUtilityTemplate().catch(console.error);
