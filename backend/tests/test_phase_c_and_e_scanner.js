import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { qrPassService } from '../src/modules/passes/qrPass.service.js';
import {
  handleOnlineScan,
  handleOfflineSync
} from '../src/modules/scanner/scanner.controller.js';
import { Pass } from '../src/models/Pass.js';
import { Registration } from '../src/models/Registration.js';
import { ScanRecord } from '../src/models/ScanRecord.js';

// Helper mock response
function createMockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
}

async function runPhaseCandETests() {
  console.log('=== RUNNING PHASE C & E: ONLINE SCANNER & MULTI-DEVICE OFFLINE SYNC TESTS ===\n');

  await mongoose.connect(env.MONGO_URI);

  // Clean test records
  await Pass.deleteMany({ inquiryId: /^TEST-SCAN-/ });
  await Registration.deleteMany({ inquiryId: /^TEST-SCAN-/ });
  await ScanRecord.deleteMany({ inquiryId: /^TEST-SCAN-/ });

  const eventA = 'prog-test-event-A';
  const eventB = 'prog-test-event-B';

  // 1. Create a test registration and pass for Event A
  const testReg = await Registration.create({
    inquiryId: 'TEST-SCAN-01',
    husbandName: 'Rajesh',
    wifeName: 'Pooja',
    surname: 'Shah',
    phoneNumber: '9825100001',
    programId: eventA,
    programName: 'Ek Duje Ke Liye Test A',
    programDate: '2026-09-07',
    status: 'approved',
    attendance: 'unmarked'
  });

  const testPass = await qrPassService.ensurePass(testReg, { id: eventA });
  console.log(`✓ Created test pass: ${testPass.passId} for inquiry ${testPass.inquiryId}`);

  // Test 1: Online Valid Scan
  console.log('\n--- 1. Online First Valid Scan Test ---');
  const req1 = {
    body: {
      qrToken: testPass.qrToken,
      eventId: eventA,
      deviceId: 'DEVICE-PHONE-1',
      deviceSequence: 1
    },
    user: { username: 'gate_operator_1' }
  };
  const res1 = createMockRes();
  await handleOnlineScan(req1, res1);

  const scan1Pass = res1.data?.result === 'VALID';
  console.log(`First scan result: ${res1.data?.result} (${scan1Pass ? 'PASS' : 'FAIL'})`);
  console.log(`Couple Name: ${res1.data?.coupleName}`);

  const updatedReg = await Registration.findById(testReg._id);
  const attendanceMarked = updatedReg.attendance === 'present';
  console.log(`Registration attendance marked present: ${attendanceMarked ? 'PASS' : 'FAIL'}`);

  // Test 2: Online Atomic Duplicate Scan
  console.log('\n--- 2. Online Duplicate Scan Prevention Test ---');
  const req2 = {
    body: {
      qrToken: testPass.qrToken,
      eventId: eventA,
      deviceId: 'DEVICE-PHONE-2',
      deviceSequence: 1
    },
    user: { username: 'gate_operator_2' }
  };
  const res2 = createMockRes();
  await handleOnlineScan(req2, res2);

  const scan2Duplicate = res2.data?.result === 'ALREADY_SCANNED';
  console.log(`Duplicate scan result: ${res2.data?.result} (${scan2Duplicate ? 'PASS' : 'FAIL'})`);

  // Test 3: Wrong Event Protection
  console.log('\n--- 3. Wrong Event Protection Test ---');
  const req3 = {
    body: {
      qrToken: testPass.qrToken,
      eventId: eventB, // scanning for Event B instead of Event A
      deviceId: 'DEVICE-PHONE-1',
      deviceSequence: 2
    },
    user: { username: 'gate_operator_1' }
  };
  const res3 = createMockRes();
  await handleOnlineScan(req3, res3);

  const wrongEventPass = res3.data?.result === 'WRONG_EVENT';
  console.log(`Wrong event scan result: ${res3.data?.result} (${wrongEventPass ? 'PASS' : 'FAIL'})`);

  // Test 4: Invalid Cryptographic Signature
  console.log('\n--- 4. Tampered QR Signature Rejection ---');
  const fakeToken = `${testPass.qrToken.slice(0, 15)}FAKE${testPass.qrToken.slice(19)}`;
  const req4 = {
    body: {
      qrToken: fakeToken,
      eventId: eventA,
      deviceId: 'DEVICE-PHONE-1'
    },
    user: { username: 'gate_operator_1' }
  };
  const res4 = createMockRes();
  await handleOnlineScan(req4, res4);

  const invalidSigPass = res4.data?.result === 'INVALID_SIGNATURE';
  console.log(`Tampered QR token result: ${res4.data?.result} (${invalidSigPass ? 'PASS' : 'FAIL'})`);

  // Test 5: Multi-Device Offline Sync & Conflict Resolution
  console.log('\n--- 5. Multi-Device Offline Sync & Conflict Resolution Test ---');
  // Create a second fresh pass for offline conflict simulation
  const regOffline = await Registration.create({
    inquiryId: 'TEST-SCAN-02',
    husbandName: 'Ketan',
    wifeName: 'Bhavna',
    surname: 'Patel',
    phoneNumber: '9825100002',
    programId: eventA,
    status: 'approved',
    attendance: 'unmarked'
  });
  const passOffline = await qrPassService.ensurePass(regOffline, { id: eventA });

  // Phone A offline scan at 18:00
  const phoneAScan = {
    scanLocalId: 'LOC-A-101',
    qrToken: passOffline.qrToken,
    passId: passOffline.passId,
    scannedAtDevice: new Date(Date.now() - 60000).toISOString(),
    deviceSequence: 1
  };

  // Phone B offline scan at 18:01 (scanned same pass offline)
  const phoneBScan = {
    scanLocalId: 'LOC-B-201',
    qrToken: passOffline.qrToken,
    passId: passOffline.passId,
    scannedAtDevice: new Date().toISOString(),
    deviceSequence: 1
  };

  // Step A: Phone A reconnects and syncs
  const syncReqA = {
    body: {
      deviceId: 'EDKL-DEVICE-PHONE-A',
      eventId: eventA,
      scans: [phoneAScan]
    },
    user: { username: 'staff_A' }
  };
  const syncResA = createMockRes();
  await handleOfflineSync(syncReqA, syncResA);

  const syncAPass = syncResA.data?.results?.[0]?.result === 'ACCEPTED';
  console.log(`Phone A Sync Result: ${syncResA.data?.results?.[0]?.result} (${syncAPass ? 'PASS' : 'FAIL'})`);

  // Step B: Phone B reconnects and syncs
  const syncReqB = {
    body: {
      deviceId: 'EDKL-DEVICE-PHONE-B',
      eventId: eventA,
      scans: [phoneBScan]
    },
    user: { username: 'staff_B' }
  };
  const syncResB = createMockRes();
  await handleOfflineSync(syncReqB, syncResB);

  const syncBConflict = syncResB.data?.results?.[0]?.result === 'CONFLICT';
  console.log(`Phone B Conflict Result: ${syncResB.data?.results?.[0]?.result} (${syncBConflict ? 'PASS' : 'FAIL'})`);

  // Step C: Re-syncing Phone A (Idempotency check)
  const syncResA2 = createMockRes();
  await handleOfflineSync(syncReqA, syncResA2);
  const syncIdempotent = syncResA2.data?.results?.[0]?.status === 'ALREADY_SYNCED';
  console.log(`Re-sync Idempotency: ${syncResA2.data?.results?.[0]?.status} (${syncIdempotent ? 'PASS' : 'FAIL'})`);

  // Clean up
  await Pass.deleteMany({ inquiryId: /^TEST-SCAN-/ });
  await Registration.deleteMany({ inquiryId: /^TEST-SCAN-/ });
  await ScanRecord.deleteMany({ inquiryId: /^TEST-SCAN-/ });
  await mongoose.disconnect();

  console.log('\n=========================================');
  console.log('PHASE C & E REPORT:');
  console.log(`ONLINE SCANNER: ${scan1Pass ? 'PASS' : 'FAIL'}`);
  console.log(`ATOMIC DUPLICATE PREVENTION: ${scan2Duplicate ? 'PASS' : 'FAIL'}`);
  console.log(`WRONG EVENT PROTECTION: ${wrongEventPass ? 'PASS' : 'FAIL'}`);
  console.log(`INVALID SIGNATURE REJECTION: ${invalidSigPass ? 'PASS' : 'FAIL'}`);
  console.log(`ATTENDANCE INTEGRATION: ${attendanceMarked ? 'PASS' : 'FAIL'}`);
  console.log(`OFFLINE MULTI-DEVICE SYNC: ${syncAPass ? 'PASS' : 'FAIL'}`);
  console.log(`OFFLINE CONFLICT RESOLUTION: ${syncBConflict ? 'PASS' : 'FAIL'}`);
  console.log(`SYNC IDEMPOTENCY: ${syncIdempotent ? 'PASS' : 'FAIL'}`);
  console.log('=========================================\n');
}

runPhaseCandETests().catch(console.error);
