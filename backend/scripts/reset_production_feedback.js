import mongoose from 'mongoose';

const PROD_URI = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function resetFeedback() {
  console.log('Connecting to production database...');
  await mongoose.connect(PROD_URI);
  const db = mongoose.connection.db;

  // 1. Reset all submitted feedbacks for EK06-03 or prog-2026-09-07
  const fbRes = await db.collection('event_feedbacks').updateMany(
    { inquiryId: 'EK06-03', eventId: 'prog-2026-09-07' },
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
  console.log(`[1] Reset event_feedbacks for EK06-03: matched ${fbRes.matchedCount}, modified ${fbRes.modifiedCount}`);

  // 2. Also check if any other feedbacks for prog-2026-09-07 are marked submitted
  const otherFeedbacks = await db.collection('event_feedbacks').find({
    eventId: 'prog-2026-09-07',
    isSubmitted: true
  }).toArray();
  console.log(`[2] Other submitted feedbacks for prog-2026-09-07: ${otherFeedbacks.length}`);

  // 3. Reset attendance on registration for EK06-03 across possible collections
  for (const collName of ['registrations', 'submissions', 'submission']) {
    const found = await db.collection(collName).findOne({ inquiryId: 'EK06-03' });
    if (found) {
      console.log(`Found EK06-03 in collection '${collName}': programId=${found.programId}, attendance=${found.attendance}`);
      const res = await db.collection(collName).updateOne(
        { _id: found._id },
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
      console.log(`Reset attendance in '${collName}': modified ${res.modifiedCount}`);
    }
  }

  // 4. Reset pass scan state for EK06-03
  const passRes = await db.collection('passes').updateOne(
    { inquiryId: 'EK06-03', eventId: 'prog-2026-09-07' },
    {
      $set: {
        firstScannedAt: null,
        lastScannedAt: null,
        firstScannedBy: null,
        scanCount: 0
      }
    }
  );
  console.log(`[4] Reset pass scan state for EK06-03: matched ${passRes.matchedCount}, modified ${passRes.modifiedCount}`);

  // 5. Delete scan records for EK06-03
  const scanRes = await db.collection('scan_records').deleteMany({
    inquiryId: 'EK06-03',
    eventId: 'prog-2026-09-07'
  });
  console.log(`[5] Deleted scan records for EK06-03: ${scanRes.deletedCount}`);

  // 6. Verify total submitted feedbacks for prog-2026-09-07 now
  const remainingSubmitted = await db.collection('event_feedbacks').countDocuments({
    eventId: 'prog-2026-09-07',
    isSubmitted: true
  });
  console.log(`[6] Remaining submitted feedbacks for prog-2026-09-07: ${remainingSubmitted}`);

  const totalFeedbacks = await db.collection('event_feedbacks').countDocuments({
    eventId: 'prog-2026-09-07'
  });
  console.log(`[7] Total feedback tokens for prog-2026-09-07: ${totalFeedbacks}`);

  await mongoose.disconnect();
  console.log('\n--- SUCCESS: Feedback has been completely reset! ---');
}

resetFeedback().catch(err => {
  console.error('Error resetting feedback:', err);
  process.exit(1);
});
