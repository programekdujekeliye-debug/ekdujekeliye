import { connectDatabase } from '../src/config/database.js';
import { sendWhatsAppMessage } from '../src/integrations/whatsapp/whatsapp.service.js';

async function test() {
  await connectDatabase();
  console.log('Testing WhatsApp dispatch to 918401473276...');
  
  const res = await sendWhatsAppMessage({
    recipientPhone: '918401473276',
    templateName: 'edkl_payment_confirmed_pass_v1',
    languageCode: 'en_US',
    templateParameters: {
      customerName: 'Jaynesh Test',
      eventName: 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan',
      eventDate: '2026-09-07',
      eventTime: '8:30 PM',
      venue: 'Sardar Patel Smruti Bhavan, Varachha, Surat',
      registrationId: 'EK-TEST-01',
      inquiryId: 'EK-TEST-01'
    },
    trigger: 'manual_diagnostic',
    executionSource: 'MANUAL_TEST'
  });

  console.log('Dispatch result:', JSON.stringify(res, null, 2));
  process.exit(0);
}

test().catch(console.error);
