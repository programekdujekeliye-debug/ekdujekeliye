import '../src/config/env.js';
import mongoose from 'mongoose';
import { Feedback } from '../src/models/Feedback.js';
import { Registration } from '../src/models/Registration.js';
import { Pass } from '../src/models/Pass.js';
import { ScanRecord } from '../src/models/ScanRecord.js';
import { invalidateLiveAttendanceStatsCache } from '../src/modules/scanner/scanner.controller.js';
import { invalidateDashboardCache } from '../src/modules/admin/admin.controller.js';

const PROD_URI = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
const uri = process.env.PROD_MONGO_URI || PROD_URI;

export async function resetTestRecord(inquiryId = 'EK06-03') {
  await mongoose.connect(uri);

  console.log(`\n--- Resetting Feedback & Attendance for ${inquiryId} ---`);

  // 1. Reset Feedback Form
  const fbRes = await Feedback.updateOne(
    { inquiryId },
    {
      $set: {
        isSubmitted: false,
        submittedAt: null,
        feedbackText: '',
        keyTakeaways: [],
        overallRating: 5,
        contentRating: 5,
        speakerRating: 5,
        venueRating: 5,
        wouldRecommend: true,
        connectionRating: 'MUCH_CLOSER',
        isTestimonialAllowed: true
      }
    }
  );
  console.log(`✓ Feedback reset (matched: ${fbRes.matchedCount}, modified: ${fbRes.modifiedCount})`);

  // 2. Reset Attendance on Registration
  const regRes = await Registration.updateOne(
    { inquiryId },
    {
      $set: { attendance: 'unmarked' },
      $unset: {
        attendanceAt: '',
        attendanceMethod: '',
        checkedIn: '',
        checkedInAt: '',
        admittedAt: '',
        scannedBy: ''
      }
    }
  );
  console.log(`✓ Registration attendance reset to 'unmarked' (modified: ${regRes.modifiedCount})`);

  // 3. Reset Pass Scan State
  const passRes = await Pass.updateOne(
    { inquiryId },
    {
      $set: {
        firstScannedAt: null,
        lastScannedAt: null,
        firstScannedBy: null,
        scanCount: 0
      }
    }
  );
  console.log(`✓ Pass scan state reset (modified: ${passRes.modifiedCount})`);

  // 4. Remove any test scan records for this inquiryId
  const scanRes = await ScanRecord.deleteMany({ inquiryId });
  console.log(`✓ Scan records cleared: ${scanRes.deletedCount}`);

  // 5. Invalidate caches
  try {
    invalidateLiveAttendanceStatsCache();
    invalidateDashboardCache();
  } catch (_) {}

  console.log(`✓ All caches invalidated.`);
  console.log(`\nRecord ${inquiryId} is now clean and ready for fresh testing or gate entry!`);

  await mongoose.disconnect();
}

if (process.argv[1] && process.argv[1].includes('reset_test_feedback_and_attendance.js')) {
  const targetId = process.argv[2] || 'EK06-03';
  resetTestRecord(targetId).catch(console.error);
}
