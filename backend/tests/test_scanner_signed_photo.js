import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { qrPassService } from '../src/modules/passes/qrPass.service.js';
import { handleOnlineScan } from '../src/modules/scanner/scanner.controller.js';
import { Pass } from '../src/models/Pass.js';
import { Registration } from '../src/models/Registration.js';
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

async function run() {
  console.log('=== TESTING SCANNER PHOTO SIGNING VERIFICATION ===');
  await mongoose.connect(env.MONGO_URI);

  const testInquiryId = 'TEST-PHOTO-01';
  await Pass.deleteMany({ inquiryId: testInquiryId });
  await Registration.deleteMany({ inquiryId: testInquiryId });
  await ScanRecord.deleteMany({ inquiryId: testInquiryId });

  const eventId = 'prog-test-event-photo';

  // Create registration with private R2 media
  const reg = await Registration.create({
    inquiryId: testInquiryId,
    husbandName: 'Kishan',
    wifeName: 'Radha',
    surname: 'Patel',
    phoneNumber: '9825199999',
    programId: eventId,
    status: 'approved',
    attendance: 'unmarked',
    mediaProvider: 'R2',
    couplePhoto: `/api/media/${testInquiryId}/couple-photo?preset=normal`,
    r2Media: {
      status: 'R2_PRIMARY',
      isPrivate: true,
      bucket: 'edkl-private-media',
      key: `prod/events/EK07/registrations/${testInquiryId}/couple/abc123/normal.webp`,
      normalKey: `prod/events/EK07/registrations/${testInquiryId}/couple/abc123/normal.webp`,
      thumbKey: `prod/events/EK07/registrations/${testInquiryId}/couple/abc123/thumb.webp`
    }
  });

  const pass = await qrPassService.ensurePass(reg, { id: eventId });

  // Test scan
  const req = {
    body: {
      qrToken: pass.qrToken,
      eventId,
      deviceId: 'DEVICE-GATE-TEST',
      deviceSequence: 1
    },
    user: { username: 'test_operator' }
  };
  const res = createMockRes();
  await handleOnlineScan(req, res);

  console.log('Scan result:', res.data.result);
  console.log('Returned couplePhoto:', res.data.couplePhoto);

  if (!res.data.couplePhoto || !res.data.couplePhoto.includes('exp=') || !res.data.couplePhoto.includes('sig=')) {
    throw new Error('FAILED: couplePhoto does NOT contain signed HMAC tokens (exp & sig)!');
  }

  console.log('SUCCESS: couplePhoto contains valid signed HMAC credentials for private R2 media!');

  // Cleanup
  await Pass.deleteMany({ inquiryId: testInquiryId });
  await Registration.deleteMany({ inquiryId: testInquiryId });
  await ScanRecord.deleteMany({ inquiryId: testInquiryId });
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
