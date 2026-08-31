import mongoose from 'mongoose';

async function checkSubmissions() {
  const uri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;

  const targetProgramId = 'prog-1787844313509-02';

  // 1. Check in 'submissions'
  const subInSubmissions = await db.collection('submissions').find({
    $or: [
      { programId: targetProgramId },
      { programDate: { $regex: '11', $options: 'i' } },
      { programDate: { $regex: '12', $options: 'i' } }
    ]
  }).toArray();
  console.log(`Found in 'submissions': ${subInSubmissions.length}`);
  subInSubmissions.forEach(s => {
    console.log(`  [submissions] ID: ${s.inquiryId} | Name: ${s.husbandName} & ${s.wifeName} | programId: ${s.programId} | programDate: ${s.programDate} | programName: ${s.programName} | venue: ${s.programVenue} | status: ${s.status}`);
  });

  // 2. Check in 'submission'
  const subInSubmission = await db.collection('submission').find({
    $or: [
      { programId: targetProgramId },
      { programDate: { $regex: '11', $options: 'i' } },
      { programDate: { $regex: '12', $options: 'i' } }
    ]
  }).toArray();
  console.log(`\nFound in 'submission': ${subInSubmission.length}`);
  subInSubmission.forEach(s => {
    console.log(`  [submission] ID: ${s.inquiryId} | Name: ${s.husbandName} & ${s.wifeName} | programId: ${s.programId} | programDate: ${s.programDate} | programName: ${s.programName} | venue: ${s.programVenue} | status: ${s.status}`);
  });

  // 3. Check passes
  const passes = await db.collection('passes').find({
    $or: [
      { programId: targetProgramId },
      { eventId: targetProgramId },
      { eventDate: { $regex: '11', $options: 'i' } },
      { eventDate: { $regex: '12', $options: 'i' } }
    ]
  }).toArray();
  console.log(`\nFound in 'passes': ${passes.length}`);
  passes.forEach(p => {
    console.log(`  [passes] PassID: ${p.passId} | InquiryID: ${p.inquiryId} | EventID: ${p.eventId} | eventDate: ${p.eventDate} | eventVenue: ${p.eventVenue}`);
  });

  process.exit(0);
}

checkSubmissions().catch(err => {
  console.error(err);
  process.exit(1);
});
