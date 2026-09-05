import { env } from '../src/config/env.js';

async function submitCompliantTemplate() {
  const wabaId = env.WHATSAPP_WABA_ID;
  console.log(`Submitting template to Meta WABA ${wabaId}...`);

  const bodyText = `દોડધામ ભરેલી જિંદગીમાં ક્યારેક સાથે બેસીને એકબીજાની આંખોમાં જોવાનો સમય પણ નથી મળતો. લગ્નજીવનમાં પ્રેમ તો હોય જ છે, પણ સમય જતાં વાતો અને સંવાદ ક્યાંક ખોવાઈ જાય છે. આ કાર્યક્રમ કોઈ ઉપદેશ આપવા માટે નથી, પણ તમારા સંબંધને ફરીથી એ જ તાજગી અને ઊંડાણ આપવા માટે એક ખાસ સાંજ છે.-મનીષ વઘાસીયા 

સંબંધમાં ફરી એ જ પ્રેમ અને સમજણ જીવંત કરવાનો અવસર એટલે—“એક દુજે કે લિયે”
જ્યાં તમે તમારા પાર્ટનર સાથે બેસીને એકબીજાને ફરીથી ઓળખશો, સમજશો અને તમારા સંબંધને વધુ મજબૂત બનાવશો.

કાર્યક્રમની વિગત:
તારીખ: 7 અને 11 સપ્ટેમ્બર, 2026
સમય: સાંજે 8:30 વાગ્યે
સ્થળ: સરદાર પટેલ સ્મૃતિ ભવન, મીની બજાર, સુરત
પ્રવેશ: ₹1,500/કપલ (સીમિત બેઠકો)
તમારા લગ્નજીવન માટે આપેલી આ બે-ત્રણ કલાકની ભેટ આખી જિંદગી યાદ રહેશે.

સીટ બુકિંગ માટે:
ekdujekeliye.in
સંપર્ક:
8200302328 / 9213532835
તમારી અને તમારા જીવનસાથીની રાહ જોશે,
મનીષ વઘાસિયા અને ‘એક દુજે કે લિયે’ પરિવાર`;

  const payload = {
    name: 'edkl_september_special_invite_v1',
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

submitCompliantTemplate().catch(console.error);

