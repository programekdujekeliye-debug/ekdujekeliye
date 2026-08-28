import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function resetTestEnvironment() {
  console.log('=== SAFE TEST DATABASE RESET UTILITY ===');
  console.log(`Current APP_ENV: ${env.APP_ENV}`);
  console.log(`Database Environment: ${env.DATABASE_ENV}`);

  // CRITICAL PRODUCTION SAFETY GUARDS
  if (env.APP_ENV === 'production') {
    throw new Error('[SAFETY REFUSAL] Cannot run reset script when APP_ENV is production!');
  }

  if (env.DATABASE_NAME === 'ekdujekeliye') {
    throw new Error('[SAFETY REFUSAL] Target database is the production database (ekdujekeliye)! Operation aborted.');
  }

  if (!env.DATABASE_NAME.includes('test') && !env.DATABASE_NAME.includes('staging')) {
    throw new Error(`[SAFETY REFUSAL] Target database name '${env.DATABASE_NAME}' is not explicitly marked test/staging.`);
  }

  const hasConfirmFlag = process.argv.includes('--confirm-test-reset');
  if (!hasConfirmFlag) {
    throw new Error('[SAFETY REFUSAL] Explicit confirmation flag required. Run with: node scripts/reset-test-environment.js --confirm-test-reset');
  }

  console.log(`\n✓ Safety checks passed. Connecting to isolated test database (${env.DATABASE_ENV})...`);
  await mongoose.connect(env.MONGO_URI);

  const collections = ['submission', 'program', 'payments', 'passes', 'scan_records', 'whatsapp_messages', 'audit_logs', 'webhook_events'];

  for (const collName of collections) {
    try {
      const count = await mongoose.connection.db.collection(collName).countDocuments({});
      if (count > 0) {
        await mongoose.connection.db.collection(collName).deleteMany({});
        console.log(` - Cleared ${count} record(s) from '${collName}' in test database.`);
      } else {
        console.log(` - Collection '${collName}' is already empty.`);
      }
    } catch (e) {
      console.log(` - Collection '${collName}' does not exist or empty.`);
    }
  }

  console.log('\n✅ Test environment reset completed successfully. Production database was completely untouched.\n');
  await mongoose.disconnect();
}

resetTestEnvironment().catch(err => {
  console.error('\n❌ RESET ABORTED:', err.message);
  process.exit(1);
});
