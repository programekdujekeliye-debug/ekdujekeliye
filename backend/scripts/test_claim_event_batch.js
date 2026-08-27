import { env } from '../src/config/env.js';

async function testClaimEventBatch() {
  console.log('====================================================');
  console.log('      TESTING CLAIM-EVENT-BATCH ROUTE & AUTH        ');
  console.log('====================================================');

  const localUrl = 'http://localhost:5001';
  const workerSecret = env.ARCHIVE_WORKER_SECRET;
  const targetEventId = 'prog-1785566789678';

  // 1. Health check capability
  console.log('\n--- 1. HEALTH CHECK ---');
  let res = await fetch(`${localUrl}/api/internal/archive/health`, {
    headers: { 'Authorization': `Bearer ${workerSecret}` }
  });
  const healthData = await res.json();
  console.log('Health Status:', res.status, healthData);

  // 2. Anonymous claim-event-batch
  console.log('\n--- 2. ANONYMOUS REJECTION TEST ---');
  res = await fetch(`${localUrl}/api/internal/archive/claim-event-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: targetEventId, limit: 5 })
  });
  console.log('Anonymous HTTP Status:', res.status, res.status === 401 ? '✅ 401 DENIED' : '❌ FAILED');

  // 3. Authorized claim for target event (currently 0 queued before queueing)
  console.log('\n--- 3. AUTHORIZED EVENT CLAIM (EMPTY QUEUE) ---');
  res = await fetch(`${localUrl}/api/internal/archive/claim-event-batch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${workerSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ eventId: targetEventId, limit: 5 })
  });
  const claimData = await res.json();
  console.log('Claim HTTP Status:', res.status, 'Count:', claimData.count, 'EventId:', claimData.eventId);

  console.log('\n====================================================');
  console.log('        CLAIM-EVENT-BATCH TEST COMPLETED            ');
  console.log('====================================================');
}

testClaimEventBatch();
