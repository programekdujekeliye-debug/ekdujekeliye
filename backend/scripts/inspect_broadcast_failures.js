import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';

async function checkFailures() {
  const dbUri = env.PROD_MONGO_URI || env.MONGO_URI;
  await mongoose.connect(dbUri, { family: 4 });
  const db = mongoose.connection.db;

  const all = await db.collection('whatsapp_messages').find({
    templateName: 'edkl_jamnagar_couples_show_v1'
  }).toArray();

  console.log(`Total messages in DB for edkl_jamnagar_couples_show_v1: ${all.length}`);

  const counts = {};
  const errors = {};
  const errorSamples = {};

  all.forEach(m => {
    counts[m.status] = (counts[m.status] || 0) + 1;
    if (m.status === 'FAILED') {
      const err = m.lastErrorCode || m.lastErrorMessage || m.error || 'NO_ERROR_SPECIFIED';
      errors[err] = (errors[err] || 0) + 1;
      if (!errorSamples[err]) {
        errorSamples[err] = {
          phone: m.recipientPhone,
          messageId: m.messageId,
          lastErrorCode: m.lastErrorCode,
          lastErrorMessage: m.lastErrorMessage,
          rawError: m.rawProviderError || m.error
        };
      }
    }
  });

  console.log('Status Counts:', counts);
  console.log('Error Breakdown:', errors);
  console.log('Error Samples:', JSON.stringify(errorSamples, null, 2));

  // Also check if webhooks arrived
  const sampleSent = all.find(m => m.status === 'SENT');
  console.log('Sample SENT message:', sampleSent ? {
    phone: sampleSent.recipientPhone,
    status: sampleSent.status,
    wamid: sampleSent.providerMessageId
  } : 'None');

  await mongoose.disconnect();
}

checkFailures().catch(console.error);
