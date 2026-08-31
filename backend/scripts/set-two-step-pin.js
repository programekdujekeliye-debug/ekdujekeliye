import { env, maskSecret } from '../src/config/env.js';

/**
 * Set or Update WhatsApp Two-Step Verification PIN via Meta Graph API
 * Official Meta Endpoint: POST https://graph.facebook.com/{VERSION}/{PHONE_NUMBER_ID}
 * Body: { "pin": "<6_DIGIT_PIN>" }
 */
async function setTwoStepVerificationPin(pin) {
  if (!pin || !/^\d{6}$/.test(pin)) {
    console.error('❌ Error: You must provide a valid 6-digit numeric PIN.');
    console.error('Usage: node scripts/set-two-step-pin.js <6_DIGIT_PIN>');
    process.exit(1);
  }

  const phoneId = env.WHATSAPP_PHONE_NUMBER_ID;
  const token = env.WHATSAPP_ACCESS_TOKEN;
  const version = env.META_GRAPH_API_VERSION || 'v22.0';

  if (!phoneId || !token) {
    console.error('❌ Error: WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN is missing in .env');
    process.exit(1);
  }

  console.log('================================================================');
  console.log('SETTING TWO-STEP VERIFICATION PIN VIA META CLOUD API');
  console.log('================================================================');
  console.log(`Phone Number ID : ${phoneId}`);
  console.log(`API Version     : ${version}`);
  console.log(`Token           : ${maskSecret(token)}`);
  console.log(`Target PIN      : ****** (6 digits)`);
  console.log('================================================================\n');

  const url = `https://graph.facebook.com/${version}/${phoneId}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pin })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ SUCCESS: Two-step verification PIN has been successfully set/updated!');
      console.log('Meta Response:', JSON.stringify(data, null, 2));
    } else {
      console.error('❌ FAILED to set PIN on Meta Graph API:');
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('❌ Network / Request Error:', err.message);
  }
}

const pinArg = process.argv[2];
if (!pinArg) {
  console.log('Usage: node scripts/set-two-step-pin.js <YOUR_NEW_6_DIGIT_PIN>');
  console.log('Example: node scripts/set-two-step-pin.js 741852');
  process.exit(0);
}

setTwoStepVerificationPin(pinArg);
