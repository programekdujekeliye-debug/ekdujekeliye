import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function audit() {
  if (env.APP_ENV === 'production' || env.DATABASE_NAME !== 'ekdujekeliye_test') {
    throw new Error('Safety block: Audit script is only intended for local test DB');
  }

  await mongoose.connect(env.MONGO_URI);
  console.log('Database:', env.DATABASE_NAME, 'Env:', env.DATABASE_ENV);

  const all = await WhatsappMessage.find({}).sort({ createdAt: -1 }).lean();
  console.log('Total WhatsappMessage records in DB:', all.length);

  let mockCount = 0;
  let realMetaCount = 0;
  let blockedFixtureCount = 0;

  all.forEach((m, idx) => {
    const isMockProvider = (m.providerMessageId && m.providerMessageId.startsWith('wamid.MOCK_TEST_')) || (m.inquiryId && m.inquiryId.startsWith('TEST-LF-'));
    const isBlockedFixture = m.recipientPhone === '919999999999' || m.inquiryId === 'TEST-NONALLOWED';
    const isRealMeta = m.providerMessageId && m.providerMessageId.startsWith('wamid.HBg');

    let category = 'UNKNOWN';
    if (isMockProvider) {
      category = 'AUTOMATED MOCK';
      mockCount++;
    } else if (isBlockedFixture) {
      category = 'BLOCKED TEST FIXTURE';
      blockedFixtureCount++;
    } else if (isRealMeta) {
      category = 'REAL META TEST';
      realMetaCount++;
    }

    console.log(`[${idx + 1}] Category: ${category} | Template: ${m.templateName} | Status: ${m.status} | Recipient: ${m.recipientMasked || m.recipientPhone} | ProviderID: ${m.providerMessageId || 'N/A'} | Inquiry: ${m.inquiryId || 'N/A'} | Date: ${m.createdAt}`);
  });

  console.log('\n--- Summary ---');
  console.log('Automated Mock Records:', mockCount);
  console.log('Blocked Test Fixtures:', blockedFixtureCount);
  console.log('Real Meta Records:', realMetaCount);
  console.log('Total Records:', all.length);

  await mongoose.disconnect();
}

audit().catch(console.error);
