import { verifyWebhook, handleWebhookEvent } from '../services/whatsappWebhook.js';

// Mock helper
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(data) {
      this.body = data;
      this.headersSent = true;
      return this;
    },
    json(data) {
      this.body = data;
      this.headersSent = true;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('--- Starting WhatsApp Webhook Unit Tests ---');
  const TEST_TOKEN = 'test_secret_token_xyz_123';
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = TEST_TOKEN;

  // Test 1: Valid GET verification
  {
    const req = {
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': TEST_TOKEN,
        'hub.challenge': '1158201244'
      }
    };
    const res = createMockRes();
    verifyWebhook(req, res);

    if (res.statusCode === 200 && res.body === '1158201244') {
      console.log('✅ Test 1 Passed: Valid GET verification returned 200 with challenge.');
    } else {
      console.error('❌ Test 1 Failed:', res.statusCode, res.body);
    }
  }

  // Test 2: Invalid GET verification token
  {
    const req = {
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': '1158201244'
      }
    };
    const res = createMockRes();
    verifyWebhook(req, res);

    if (res.statusCode === 403) {
      console.log('✅ Test 2 Passed: Invalid token returned 403 Forbidden.');
    } else {
      console.error('❌ Test 2 Failed:', res.statusCode, res.body);
    }
  }

  // Test 3: Missing mode
  {
    const req = {
      query: {
        'hub.verify_token': TEST_TOKEN,
        'hub.challenge': '1158201244'
      }
    };
    const res = createMockRes();
    verifyWebhook(req, res);

    if (res.statusCode === 403) {
      console.log('✅ Test 3 Passed: Missing mode returned 403 Forbidden.');
    } else {
      console.error('❌ Test 3 Failed:', res.statusCode, res.body);
    }
  }

  // Test 4: POST event handling with sample Meta payload
  {
    const samplePayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '10987654321',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '919999999999',
                  phone_number_id: '1234567890'
                },
                statuses: [
                  {
                    id: 'wamid.HBgLMDExMjM0NTY3OAA=',
                    status: 'delivered',
                    timestamp: '1740000000',
                    recipient_id: '919876543210'
                  }
                ],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgLMDExMjM0NTY3OAA=',
                    timestamp: '1740000000',
                    text: { body: 'Hello' },
                    type: 'text'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    };

    const req = { body: samplePayload };
    const res = createMockRes();
    handleWebhookEvent(req, res);

    if (res.statusCode === 200 && res.body?.status === 'received') {
      console.log('✅ Test 4 Passed: POST payload processed successfully and returned 200.');
    } else {
      console.error('❌ Test 4 Failed:', res.statusCode, res.body);
    }
  }

  console.log('--- All WhatsApp Webhook Tests Completed ---');
}

runTests();
