/**
 * EDKL — Safe Automated WhatsApp Test Artifact Cleanup Utility
 * Removes ONLY automated mock test fixtures (wamid.MOCK_TEST_*, TEST-LF-*, 919999999999)
 * Preserves all real Meta WhatsApp messages (wamid.HBg*, manual test records)
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { WhatsappMessage } from '../src/models/WhatsappMessage.js';

async function cleanupAutomatedTestArtifacts() {
  console.log('====================================================');
  console.log('EDKL SAFE AUTOMATED WHATSAPP TEST ARTIFACT CLEANUP');
  console.log('====================================================');
  console.log(`Environment: ${env.DATABASE_ENV}`);
  console.log(`Database: ${env.DATABASE_NAME}`);

  // CRITICAL PRODUCTION SAFETY GUARDS
  if (env.APP_ENV === 'production') {
    throw new Error('[SAFETY REFUSAL] Cannot run test cleanup script in production!');
  }

  if (env.DATABASE_NAME === 'ekdujekeliye') {
    throw new Error('[SAFETY REFUSAL] Target database is the production database (ekdujekeliye)! Operation aborted.');
  }

  if (!env.DATABASE_NAME.includes('test') && !env.DATABASE_NAME.includes('staging')) {
    throw new Error(`[SAFETY REFUSAL] Target database name '${env.DATABASE_NAME}' is not explicitly marked test/staging.`);
  }

  const isConfirmed = process.argv.includes('--confirm');

  await mongoose.connect(env.MONGO_URI);

  // Define narrow filter matching ONLY automated test fixtures
  const mockFilter = {
    $or: [
      { providerMessageId: { $regex: '^wamid\\.MOCK_TEST_' } },
      { inquiryId: { $regex: '^TEST-LF-' } },
      { recipientPhone: '919999999999' },
      { executionSource: 'AUTOMATED_TEST' },
      { providerMode: 'MOCK' }
    ]
  };

  const mockRecords = await WhatsappMessage.find(mockFilter).sort({ createdAt: -1 }).lean();
  const realRecords = await WhatsappMessage.find({ $nor: [mockFilter] }).sort({ createdAt: -1 }).lean();

  console.log(`\nAutomated mock records found: ${mockRecords.length}`);
  console.log(`Real Meta / manual records preserved: ${realRecords.length}\n`);

  if (mockRecords.length > 0) {
    console.log('--- Automated Mock Records Identified ---');
    mockRecords.forEach((m, idx) => {
      console.log(` [${idx + 1}] Template: ${m.templateName} | Status: ${m.status} | Recipient: ${m.recipientMasked || m.recipientPhone} | ProviderID: ${m.providerMessageId || 'N/A'} | Inquiry: ${m.inquiryId || 'N/A'} | Created: ${m.createdAt}`);
    });
  }

  if (realRecords.length > 0) {
    console.log('\n--- Real Meta / Manual Records to PRESERVE ---');
    realRecords.forEach((m, idx) => {
      console.log(` [${idx + 1}] Template: ${m.templateName} | Status: ${m.status} | Recipient: ${m.recipientMasked || m.recipientPhone} | ProviderID: ${m.providerMessageId || 'N/A'} | Inquiry: ${m.inquiryId || 'N/A'}`);
    });
  }

  if (!isConfirmed) {
    console.log('\n====================================================');
    console.log('[DRY RUN ONLY] No records were deleted.');
    console.log("To execute deletion of automated mock records, re-run with '--confirm':");
    console.log('  node scripts/cleanup-automated-whatsapp-test-artifacts.js --confirm');
    console.log('====================================================\n');
    await mongoose.disconnect();
    return;
  }

  // Perform deletion of ONLY automated test fixtures
  const deleteResult = await WhatsappMessage.deleteMany(mockFilter);

  console.log('\n====================================================');
  console.log(`✅ CLEANUP SUCCESSFUL: Removed ${deleteResult.deletedCount} automated test artifact(s).`);
  console.log(`Preserved ${realRecords.length} genuine Meta / manual record(s).`);
  console.log('Production database was completely untouched.');
  console.log('====================================================\n');

  await mongoose.disconnect();
}

cleanupAutomatedTestArtifacts().catch(err => {
  console.error('\n❌ CLEANUP ABORTED:', err.message);
  process.exit(1);
});
