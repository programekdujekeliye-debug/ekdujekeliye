import { env } from '../src/config/env.js';

async function submitJamnagarTemplate() {
  const wabaId = env.WHATSAPP_WABA_ID;
  console.log(`Submitting Jamnagar Couples Show template to Meta WABA ${wabaId}...`);

  const bodyText = `🙏🏻 રાજકોટવાસીઓનો હૃદયપૂર્વક આભાર!
રાજકોટમાં યોજાયેલ “એક દૂજે કે લિયે” કાર્યક્રમને મળેલા સુંદર પ્રતિસાદ અને પ્રેમ બદલ આપ સૌનો ખૂબ ખૂબ આભાર. ❤️

હવે આવતીકાલે જામનગરમાં “એક દૂજે કે લિયે”નો ખાસ Couples Show યોજાઈ રહ્યો છે.
જો તમારા પરિવાર, મિત્રો અથવા ઓળખીતાઓ જામનગરમાં રહેતા હોય, તો આ માહિતી તેમની સાથે જરૂર શેર કરજો. તમે તમારા પ્રિય Coupleને આ કાર્યક્રમની Ticket Gift પણ કરી શકો છો. 🎁

📍 સ્થળ: M. P. Shah Town Hall, Jamnagar
📅 તારીખ: 10 September 2026
⏰ સમય: રાત્રે 8:30 વાગ્યે

🎟️ Ticket Booking:
https://app.wowsly.com/e/3196/ek-duje-ke-liye

📞 વધુ માહિતી માટે:
8320208784 / 8866033383

આવતીકાલે જામનગરમાં મળીએ. ❤️
Ek Duje Ke Liye Team`;

  const payload = {
    name: 'edkl_jamnagar_couples_show_v1',
    category: 'MARKETING',
    language: 'gu',
    components: [
      {
        type: 'BODY',
        text: bodyText
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
    console.log('Meta API Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error submitting template:', e.message);
  }
}

submitJamnagarTemplate().catch(console.error);
