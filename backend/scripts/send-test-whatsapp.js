import { env } from '../src/config/env.js';
import {
  sendDirectTemplateMessage,
  sendDirectTextMessage,
  inspectSenderPhoneAndWABA,
  normalizeWhatsAppRecipient
} from '../src/integrations/whatsapp/whatsapp.service.js';

async function main() {
  const args = process.argv.slice(2);
  const isTextMode = args.includes('--text');
  const targetPhone = env.WHATSAPP_TEST_RECIPIENTS[0] || '918320594829';
  const normalizedRecipient = normalizeWhatsAppRecipient(targetPhone);

  console.log('====================================================');
  console.log('EDKL META WHATSAPP CLOUD API DIAGNOSTIC SENDER');
  console.log('====================================================');
  console.log(`APP_ENV: ${env.APP_ENV}`);
  console.log(`DATABASE ENVIRONMENT: ${env.DATABASE_ENV}`);
  console.log(`WHATSAPP MODE: ${env.WHATSAPP_MODE.toUpperCase()}`);
  console.log(`Recipient Allowlist: ${env.WHATSAPP_TEST_RECIPIENTS.join(', ')}`);
  console.log(`Target Test Recipient: ${normalizedRecipient}`);
  console.log(`Recipient in Allowlist: ${env.WHATSAPP_TEST_RECIPIENTS.includes(normalizedRecipient) ? 'YES' : 'NO'}`);
  console.log(`Sender Phone Number ID Configured: ${env.WHATSAPP_PHONE_NUMBER_ID ? 'YES' : 'NO'}`);
  console.log(`Access Token Configured: ${env.WHATSAPP_ACCESS_TOKEN ? 'YES' : 'NO'}`);
  console.log('====================================================\n');

  if (!env.WHATSAPP_ACCESS_TOKEN) {
    console.log('❌ WHATSAPP_ACCESS_TOKEN is missing in environment.');
    console.log('Configure WHATSAPP_ACCESS_TOKEN in backend/.env before running diagnostic.');
    process.exit(1);
  }

  // 1. Inspect Sender Phone & WABA on Meta Graph API
  console.log('--- STEP 1: SENDER PHONE & WABA INSPECTION ---');
  const inspection = await inspectSenderPhoneAndWABA();
  if (inspection.phoneInfo) {
    console.log('✓ Sender Phone Info Found on Meta:');
    console.log(`  - ID: ${inspection.phoneInfo.id}`);
    console.log(`  - Display Number: ${inspection.phoneInfo.displayPhoneNumber || 'N/A'}`);
    console.log(`  - Verified Name: ${inspection.phoneInfo.verifiedName || 'N/A'}`);
    console.log(`  - Verification Status: ${inspection.phoneInfo.codeVerificationStatus || 'N/A'}`);
    console.log(`  - Quality Rating: ${inspection.phoneInfo.qualityRating || 'N/A'}`);
    console.log(`  - Status: ${inspection.phoneInfo.status || 'N/A'}`);
  } else if (inspection.phoneError) {
    console.warn(`⚠️ Phone Number ID Inspection Warning: ${inspection.phoneError}`);
  }

  if (inspection.wabaPhoneNumbers && inspection.wabaPhoneNumbers.length > 0) {
    console.log(`✓ WABA Phone Numbers Found (${inspection.wabaPhoneNumbers.length}):`);
    inspection.wabaPhoneNumbers.forEach((p, idx) => {
      console.log(`  [${idx + 1}] ID: ${p.id} | Display: ${p.displayPhoneNumber} | Name: ${p.verifiedName} | Status: ${p.status}`);
    });
  }

  // 2. Dispatch Message to Test Recipient
  console.log(`\n--- STEP 2: META CLOUD API DISPATCH (${isTextMode ? 'FREE-FORM TEXT' : 'OFFICIAL HELLO_WORLD TEMPLATE'}) ---`);
  console.log(`Target Recipient: ${normalizedRecipient}`);

  let result;
  if (isTextMode) {
    console.log('Sending: Direct Text Message...');
    result = await sendDirectTextMessage({
      to: normalizedRecipient,
      text: 'Ek Duje Ke Liye Connectivity Test - What can I help you today?'
    });
  } else {
    console.log('Sending: Meta Utility Template (hello_world, en_US)...');
    result = await sendDirectTemplateMessage({
      to: normalizedRecipient,
      templateName: 'hello_world',
      languageCode: 'en_US'
    });
  }

  console.log('\n--- STEP 3: META DISPATCH RESULT ---');
  console.log(`HTTP STATUS: ${result.httpStatus || (result.success ? '200' : 'FAILED')}`);
  console.log(`META ACCEPTED: ${result.success ? 'YES' : 'NO'}`);

  if (result.success) {
    const maskedWamid = result.providerMessageId
      ? `${result.providerMessageId.substring(0, 12)}...${result.providerMessageId.slice(-6)}`
      : 'RECEIVED';
    console.log(`PROVIDER MESSAGE ID: ${maskedWamid}`);
    console.log('\n====================================================');
    console.log('IMPORTANT REAL DELIVERY NOTE:');
    console.log('1. Meta has ACCEPTED the message for processing.');
    console.log('2. Please check your physical test phone to confirm receipt.');
    console.log('3. Real delivery status will be confirmed when Meta webhook delivers statuses[].status = "delivered".');
    console.log('====================================================\n');
  } else {
    console.log(`PROVIDER MESSAGE ID: NOT RECEIVED`);
    console.log(`ERROR CODE: ${result.code || 'UNKNOWN'}`);
    console.log(`ERROR MESSAGE: ${result.error || 'Unknown error'}`);
    if (result.code === 131047) {
      console.log('DIAGNOSTIC: Error 131047 indicates free-form text outside 24h window. Run with --template instead.');
    } else if (result.code === 131026) {
      console.log('DIAGNOSTIC: Error 131026 indicates recipient number is not registered/reachable or not verified in Meta developer test recipients.');
    }
  }
}

main().catch(err => {
  console.error('\n❌ Unhandled diagnostic error:', err.message);
  process.exit(1);
});
