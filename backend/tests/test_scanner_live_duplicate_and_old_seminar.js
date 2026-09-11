import assert from 'assert';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { qrPassService } from '../src/modules/passes/qrPass.service.js';
import { handleOnlineScan, handleManualAttendance } from '../src/modules/scanner/scanner.controller.js';
import { Pass } from '../src/models/Pass.js';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';
import { ScanRecord } from '../src/models/ScanRecord.js';

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

async function runLiveScannerTests() {
  console.log('=== RUNNING LIVE SCANNER DUPLICATE & OLD SEMINAR RESOLUTION TESTS ===\n');

  await mongoose.connect(env.MONGO_URI);

  // Clean test fixtures
  await Pass.deleteMany({ inquiryId: /^TEST-LIVE-/ });
  await Registration.deleteMany({ inquiryId: /^TEST-LIVE-/ });
  await ScanRecord.deleteMany({ passId: /^TEST-LIVE-/ });
  await Event.deleteMany({ id: { $in: ['prog-live-tonight', 'prog-live-august'] } });

  // 1. Create Tonight's Event and an Old August Seminar
  const tonightEvent = await Event.create({
    id: 'prog-live-tonight',
    slug: 'seminar-11-sep-surat',
    name: 'Ek Duje Ke Liye Surat Seminar',
    date: '2026-09-11',
    time: '8:30 PM',
    capacity: 500,
    status: 'upcoming'
  });

  const augustEvent = await Event.create({
    id: 'prog-live-august',
    slug: 'seminar-15-aug-surat',
    name: 'Ek Duje Ke Liye August Special',
    date: '2026-08-15',
    time: '8:30 PM',
    capacity: 500,
    status: 'completed'
  });

  console.log(`✓ Seeded Tonight Event: ${tonightEvent.id} (${tonightEvent.date})`);
  console.log(`✓ Seeded Old Seminar: ${augustEvent.id} (${augustEvent.date})`);

  // -------------------------------------------------------------
  // Test 1: First-Time Scan with Event Date Alias (Resolves Duplicate Bug)
  // -------------------------------------------------------------
  console.log('\n--- 1. First-Time Scan with Date-as-ProgramId Alias ---');
  const reg1 = await Registration.create({
    inquiryId: 'TEST-LIVE-01',
    husbandName: 'Ketan',
    wifeName: 'Daksha',
    surname: 'Patel',
    phoneNumber: '9825199991',
    programId: '2026-09-11', // Stored as date string
    programDate: '2026-09-11',
    status: 'approved',
    attendance: 'unmarked'
  });

  const pass1 = await qrPassService.ensurePass(reg1, tonightEvent);
  console.log(`✓ Created pass for attendee: ${pass1.passId}, pass.eventId: "${pass1.eventId}"`);

  const req1 = {
    body: {
      qrToken: pass1.qrToken,
      eventId: 'prog-live-tonight', // Scanner uses canonical event ID
      deviceId: 'DEVICE-GATE-1',
      deviceSequence: 1
    },
    user: { username: 'gate_operator' }
  };
  const res1 = createMockRes();
  await handleOnlineScan(req1, res1);

  assert.strictEqual(res1.data?.result, 'VALID', `Expected first-time scan to be VALID, got: ${res1.data?.result}`);
  assert.strictEqual(res1.data?.coupleName, 'Ketan & Daksha Patel');
  console.log(`✓ First-time scan succeeded: result=${res1.data?.result}, coupleName="${res1.data?.coupleName}"`);

  // Verify registration marked present
  const updatedReg1 = await Registration.findById(reg1._id);
  assert.strictEqual(updatedReg1.attendance, 'present');
  console.log(`✓ Registration attendance correctly updated to 'present'`);

  // -------------------------------------------------------------
  // Test 2: Same-Device Recent Echo (Prevents False Duplicate Warning)
  // -------------------------------------------------------------
  console.log('\n--- 2. Same-Device Echo Scan Protection ---');
  const reqEcho = {
    body: {
      qrToken: pass1.qrToken,
      eventId: 'prog-live-tonight',
      deviceId: 'DEVICE-GATE-1', // SAME device
      deviceSequence: 2
    },
    user: { username: 'gate_operator' }
  };
  const resEcho = createMockRes();
  await handleOnlineScan(reqEcho, resEcho);

  assert.strictEqual(resEcho.data?.result, 'VALID', `Expected same-device echo within 8s to be VALID, got: ${resEcho.data?.result}`);
  assert(resEcho.data?.message.includes('Already verified on this scanner'), 'Expected message indicating already verified on this scanner');
  console.log(`✓ Same-device echo handled cleanly: result=${resEcho.data?.result}, message="${resEcho.data?.message}"`);

  // -------------------------------------------------------------
  // Test 3: Genuine Duplicate Scan from Different Device
  // -------------------------------------------------------------
  console.log('\n--- 3. Genuine Duplicate Scan from Different Device ---');
  const reqOtherDevice = {
    body: {
      qrToken: pass1.qrToken,
      eventId: 'prog-live-tonight',
      deviceId: 'DEVICE-GATE-2', // DIFFERENT device
      deviceSequence: 1
    },
    user: { username: 'gate_operator_2' }
  };
  const resOtherDevice = createMockRes();
  await handleOnlineScan(reqOtherDevice, resOtherDevice);

  assert.strictEqual(resOtherDevice.data?.result, 'ALREADY_SCANNED', `Expected different device to be ALREADY_SCANNED, got: ${resOtherDevice.data?.result}`);
  assert(resOtherDevice.data?.firstScannedAt, 'Expected non-null firstScannedAt');
  console.log(`✓ Real duplicate correctly rejected: result=${resOtherDevice.data?.result}, firstScannedAt=${resOtherDevice.data?.firstScannedAt}`);

  // -------------------------------------------------------------
  // Test 4: Old August Seminar QR Code Identification
  // -------------------------------------------------------------
  console.log('\n--- 4. Old August Seminar Pass Identification ---');
  const regAugust = await Registration.create({
    inquiryId: 'TEST-LIVE-AUG',
    husbandName: 'Amit',
    wifeName: 'Sonal',
    surname: 'Mehta',
    phoneNumber: '9825188888',
    programId: augustEvent.id,
    programDate: augustEvent.date,
    status: 'approved',
    attendance: 'present'
  });

  const passAugust = await qrPassService.ensurePass(regAugust, augustEvent);
  console.log(`✓ Created pass for old August seminar: ${passAugust.passId}`);

  const reqAugustScan = {
    body: {
      qrToken: passAugust.qrToken,
      eventId: 'prog-live-tonight', // Presented at tonight's gate
      deviceId: 'DEVICE-GATE-1',
      deviceSequence: 3
    },
    user: { username: 'gate_operator' }
  };
  const resAugustScan = createMockRes();
  await handleOnlineScan(reqAugustScan, resAugustScan);

  assert.strictEqual(resAugustScan.data?.result, 'WRONG_EVENT', `Expected WRONG_EVENT, got: ${resAugustScan.data?.result}`);
  assert.strictEqual(resAugustScan.data?.registeredForEvent, 'Ek Duje Ke Liye August Special');
  assert.strictEqual(resAugustScan.data?.registeredForDate, '2026-08-15');
  assert.strictEqual(resAugustScan.data?.coupleName, 'Amit & Sonal Mehta');
  assert(resAugustScan.data?.message.includes('earlier seminar'), 'Message must clearly explain earlier seminar');
  console.log(`✓ Old seminar detected accurately:`);
  console.log(`  - result: ${resAugustScan.data?.result}`);
  console.log(`  - registeredForEvent: "${resAugustScan.data?.registeredForEvent}"`);
  console.log(`  - registeredForDate: "${resAugustScan.data?.registeredForDate}"`);
  console.log(`  - coupleName: "${resAugustScan.data?.coupleName}"`);
  console.log(`  - message: "${resAugustScan.data?.message}"`);

  // -------------------------------------------------------------
  // Test 5: Manual Entry of Old Seminar Pass ID
  // -------------------------------------------------------------
  console.log('\n--- 5. Manual Fallback with Old Seminar Pass ID ---');
  const reqManualOld = {
    body: {
      identifier: passAugust.passId,
      eventId: 'prog-live-tonight',
      deviceId: 'MANUAL-DESK-1'
    },
    user: { username: 'admin' }
  };
  const resManualOld = createMockRes();
  await handleManualAttendance(reqManualOld, resManualOld);

  assert.strictEqual(resManualOld.data?.result, 'WRONG_EVENT');
  assert.strictEqual(resManualOld.data?.registeredForEvent, 'Ek Duje Ke Liye August Special');
  console.log(`✓ Manual entry of old pass ID correctly identified as old seminar: result=${resManualOld.data?.result}`);

  // Cleanup
  await Pass.deleteMany({ inquiryId: /^TEST-LIVE-/ });
  await Registration.deleteMany({ inquiryId: /^TEST-LIVE-/ });
  await ScanRecord.deleteMany({ passId: /^TEST-LIVE-/ });
  await Event.deleteMany({ id: { $in: ['prog-live-tonight', 'prog-live-august'] } });
  await mongoose.disconnect();

  console.log('\n=========================================');
  console.log('ALL LIVE SCANNER RESOLUTION TESTS PASSED!');
  console.log('=========================================');
}

runLiveScannerTests().catch(err => {
  console.error('[TEST FAILURE]:', err);
  process.exit(1);
});
