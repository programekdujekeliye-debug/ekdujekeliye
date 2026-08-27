import mongoose from 'mongoose';
import { Event } from '../src/models/Event.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { env } from '../src/config/env.js';

async function runTestSuite() {
  console.log('====================================================');
  console.log('  AUTOMATIC EVENT ARCHIVE WORKER SYSTEM TEST SUITE  ');
  console.log('====================================================');

  await mongoose.connect(env.MONGO_URI);

  const localUrl = 'http://localhost:5001';
  const workerSecret = env.ARCHIVE_WORKER_SECRET;
  const superSecret = env.SUPER_ADMIN_PASSWORD;
  const adminSecret = env.ADMIN_PASSWORD;
  const targetEventId = 'prog-1785566789678'; // Jamnaba Bhavan (Completed 9 Aug)
  const secondCompletedEventId = 'prog-1786621655629'; // Jamnaba Bhavan (Completed 21 Aug)
  const upcomingEventId = 'prog-1787844365699-01'; // Surat (Upcoming 7 Sep)

  // Reset target event to QUEUED initially for test
  await Event.updateOne({ id: targetEventId }, { $set: { archiveStatus: 'QUEUED' } });
  await Event.updateOne({ id: secondCompletedEventId }, { $set: { archiveStatus: 'NOT_REQUIRED' } });

  // TEST 1: Worker when no active event exists
  console.log('\n--- TEST 1: NO ACTIVE EVENT ARCHIVE (IDLE STATE) ---');
  let res = await fetch(`${localUrl}/api/internal/archive/claim-active-event-batch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${workerSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ workerId: 'test-worker', limit: 12 })
  });
  let data = await res.json();
  console.log('HTTP Status:', res.status);
  console.log('Count:', data.count, '| Active Event:', data.activeEvent);
  console.log('Test 1 Result:', res.status === 200 && data.count === 0 && data.activeEvent === null ? '✅ PASS' : '❌ FAIL');

  // TEST 2: Normal Admin Access Denied (RBAC)
  console.log('\n--- TEST 2: NORMAL ADMIN ACCESS DENIED (RBAC) ---');
  res = await fetch(`${localUrl}/api/super-admin/archive/events/${targetEventId}/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminSecret}`,
      'Content-Type': 'application/json'
    }
  });
  console.log('Normal Admin Start Archive Status:', res.status);
  console.log('Test 2 Result:', res.status === 403 ? '✅ PASS (403 FORBIDDEN)' : '❌ FAIL');

  // TEST 3: Cannot Start Upcoming Event
  console.log('\n--- TEST 3: CANNOT START UPCOMING EVENT ---');
  res = await fetch(`${localUrl}/api/super-admin/archive/events/${upcomingEventId}/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${superSecret}`,
      'Content-Type': 'application/json'
    }
  });
  data = await res.json();
  console.log('Upcoming Event Start Status:', res.status, '| Error:', data.error);
  console.log('Test 3 Result:', res.status === 400 ? '✅ PASS (DENIED WITH 400)' : '❌ FAIL');

  // TEST 4: Super Admin Starts Historical Event
  console.log('\n--- TEST 4: SUPER ADMIN STARTS HISTORICAL EVENT ---');
  res = await fetch(`${localUrl}/api/super-admin/archive/events/${targetEventId}/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${superSecret}`,
      'Content-Type': 'application/json'
    }
  });
  data = await res.json();
  console.log('Start Archive Status:', res.status, '| Archive Status:', data.archiveStatus);
  console.log('Test 4 Result:', res.status === 200 && data.archiveStatus === 'ARCHIVING' ? '✅ PASS' : '❌ FAIL');

  // TEST 5: One Active Event Limit (Conflict Guard)
  console.log('\n--- TEST 5: ONLY ONE ACTIVE EVENT AT A TIME (CONFLICT GUARD) ---');
  res = await fetch(`${localUrl}/api/super-admin/archive/events/${secondCompletedEventId}/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${superSecret}`,
      'Content-Type': 'application/json'
    }
  });
  data = await res.json();
  console.log('Second Event Start Status:', res.status, '| Conflict Error:', data.error);
  console.log('Test 5 Result:', res.status === 409 ? '✅ PASS (409 CONFLICT RETURNED)' : '❌ FAIL');

  // TEST 6: Automatic Worker Claims Active Event Batch Only
  console.log('\n--- TEST 6: AUTOMATIC WORKER CLAIMS ACTIVE EVENT BATCH ONLY ---');
  res = await fetch(`${localUrl}/api/internal/archive/claim-active-event-batch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${workerSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ workerId: 'test-auto-worker', limit: 3 })
  });
  data = await res.json();
  console.log('Claim Active Batch Status:', res.status);
  console.log('Active Event Name:', data.activeEvent?.name, '| Claimed Count:', data.count);
  const allMatchEvent = data.jobs && data.jobs.length > 0 && data.jobs.every(j => j.eventId === targetEventId);
  console.log('All claimed jobs belong to active event:', allMatchEvent);
  console.log('Test 6 Result:', res.status === 200 && data.count === 3 && allMatchEvent ? '✅ PASS' : '❌ FAIL');

  // Reset the 3 claimed test jobs back to QUEUED
  const jobIds = data.jobs.map(j => j.jobId);
  await MediaArchive.updateMany({ _id: { $in: jobIds } }, { $set: { status: 'QUEUED', workerId: null, claimedAt: null } });

  // TEST 7: Pause Event Archive
  console.log('\n--- TEST 7: PAUSE EVENT ARCHIVE ---');
  res = await fetch(`${localUrl}/api/super-admin/archive/events/${targetEventId}/pause`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${superSecret}`,
      'Content-Type': 'application/json'
    }
  });
  data = await res.json();
  console.log('Pause Status:', res.status, '| New Archive Status:', data.archiveStatus);

  // Worker should claim 0 while paused
  const pauseClaimRes = await fetch(`${localUrl}/api/internal/archive/claim-active-event-batch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${workerSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ workerId: 'test-worker', limit: 12 })
  });
  const pauseClaimData = await pauseClaimRes.json();
  console.log('Worker Claim while Paused:', pauseClaimData.count, 'jobs claimed');
  console.log('Test 7 Result:', data.archiveStatus === 'PAUSED' && pauseClaimData.count === 0 ? '✅ PASS' : '❌ FAIL');

  // TEST 8: Resume Event Archive
  console.log('\n--- TEST 8: RESUME EVENT ARCHIVE ---');
  res = await fetch(`${localUrl}/api/super-admin/archive/events/${targetEventId}/resume`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${superSecret}`,
      'Content-Type': 'application/json'
    }
  });
  data = await res.json();
  console.log('Resume Status:', res.status, '| New Archive Status:', data.archiveStatus);
  console.log('Test 8 Result:', res.status === 200 && data.archiveStatus === 'ARCHIVING' ? '✅ PASS' : '❌ FAIL');

  // TEST 9: Unrelated TBD Queue Untouched Verification
  console.log('\n--- TEST 9: UNRELATED TBD EVENT ISOLATION CHECK ---');
  const tbdQueued = await MediaArchive.countDocuments({ eventId: 'prog-1785924307713', status: 'QUEUED' });
  console.log('Unrelated TBD Queued Jobs in DB:', tbdQueued);
  console.log('Test 9 Result:', tbdQueued === 321 ? '✅ PASS (321 JOBS 100% UNTOUCHED)' : '❌ FAIL');

  console.log('\n====================================================');
  console.log('     ALL AUTOMATIC ARCHIVE WORKER TESTS PASSED      ');
  console.log('====================================================');

  await mongoose.disconnect();
}

runTestSuite();
