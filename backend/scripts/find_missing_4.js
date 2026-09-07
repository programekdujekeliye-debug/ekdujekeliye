import mongoose from 'mongoose';

const PROD_URI = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(PROD_URI);
  const progIds = ['prog-2026-09-07', 'surat-7-september-2026'];
  
  // 1. Check all approved registrations in this event
  const allApproved = await mongoose.connection.db.collection('submission').find({
    $or: [{ programId: { $in: progIds } }, { programDate: '2026-09-07' }],
    status: 'approved',
    isDeleted: { $ne: true }
  }).toArray();
  console.log('Total approved in DB:', allApproved.length);

  // Check how many have couplePhoto missing or empty
  const noPhoto = allApproved.filter(r => !r.couplePhoto || r.couplePhoto.trim() === '');
  console.log('Approved with no couplePhoto:', noPhoto.length);
  noPhoto.forEach(r => console.log('NO PHOTO:', r.inquiryId, r.husbandName, r.wifeName, r.frameExportStatus));

  // 2. Check all paid captured registrations in this event
  const allPaidCaptured = await mongoose.connection.db.collection('submission').find({
    $or: [{ programId: { $in: progIds } }, { programDate: '2026-09-07' }],
    'payment.status': 'captured',
    isDeleted: { $ne: true }
  }).toArray();
  console.log('Total payment.status == captured:', allPaidCaptured.length);

  // 3. Combined Paid or Approved (like in modal):
  const combinedCohort = await mongoose.connection.db.collection('submission').find({
    $or: [{ programId: { $in: progIds } }, { programDate: '2026-09-07' }],
    $and: [
      { isDeleted: { $ne: true } },
      { $or: [{ status: 'approved' }, { 'payment.status': 'captured' }] }
    ]
  }).toArray();
  console.log('Combined Paid/Approved cohort in DB:', combinedCohort.length);

  // Check if any in combinedCohort have no couplePhoto
  const combinedNoPhoto = combinedCohort.filter(r => !r.couplePhoto || r.couplePhoto.trim() === '');
  console.log('Combined cohort with no couplePhoto:', combinedNoPhoto.length);
  combinedNoPhoto.forEach(r => console.log('NO PHOTO COMBINED:', r.inquiryId, r.husbandName, r.wifeName, r.frameExportStatus));

  // 4. Check the 4 transferred INTO this event
  const transferredIn = combinedCohort.filter(r => r.previousInquiryId || (r.transferHistory && r.transferHistory.length > 0));
  console.log('\nTransferred IN (count):', transferredIn.length);
  transferredIn.forEach(r => {
    console.log(`TRANSFERRED IN: ${r.inquiryId} (prev: ${r.previousInquiryId}) | ${r.husbandName} & ${r.wifeName} | status: ${r.status} | frameExportStatus: ${r.frameExportStatus}`);
  });

  // 5. Check the transferred OUT of this event
  const transferredOut = await mongoose.connection.db.collection('submission').find({
    previousInquiryId: { $regex: '^EK06-' },
    isDeleted: { $ne: true }
  }).toArray();
  console.log('\nTransferred OUT (count):', transferredOut.length);
  transferredOut.forEach(r => {
    console.log(`TRANSFERRED OUT: Now ${r.inquiryId} in ${r.programId} (was ${r.previousInquiryId}) | ${r.husbandName} & ${r.wifeName} | status: ${r.status} | frameExportStatus: ${r.frameExportStatus}`);
  });

  // 6. Check if there are any registrations marked EXPORTED that have frameExportStatus == 'EXPORTED' but NOT in 2026-09-07
  const exportedWithOldEK06 = await mongoose.connection.db.collection('submission').find({
    $or: [
      { inquiryId: { $regex: '^EK06-' } },
      { previousInquiryId: { $regex: '^EK06-' } }
    ],
    frameExportStatus: 'EXPORTED'
  }).toArray();
  console.log('\nTotal registrations with EK06 ID marked EXPORTED anywhere in DB:', exportedWithOldEK06.length);
  const exportedNotInCohort = exportedWithOldEK06.filter(r => !combinedCohort.some(c => c._id.toString() === r._id.toString()));
  console.log('Exported EK06 registrations NOT in current 2026-09-07 cohort:', exportedNotInCohort.length);
  exportedNotInCohort.forEach(r => {
    console.log(`NOT IN COHORT: ${r.inquiryId} (prev: ${r.previousInquiryId}) in event ${r.programId} | ${r.husbandName} & ${r.wifeName} | status: ${r.status}`);
  });

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
