import { connectDatabase } from '../src/config/database.js';
import mongoose from 'mongoose';

const prodUri = 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(prodUri, { family: 4 });
  console.log('Connected to ekdujekeliye production database.');

  const db = mongoose.connection.db;

  const programDocs = await db.collection('program').find({}).toArray();
  console.log(`\n=== 'program' collection (${programDocs.length} docs) ===`);
  programDocs.forEach(p => {
    console.log(`ID: "${p.id}" | Sequence: ${p.sequenceNumber} | Date: "${p.date}" | Name: "${p.name}" | Capacity: ${p.capacity} | Status: "${p.status}"`);
  });

  const programsDocs = await db.collection('programs').find({}).toArray();
  console.log(`\n=== 'programs' collection (${programsDocs.length} docs) ===`);
  programsDocs.forEach(p => {
    console.log(`ID: "${p.id}" | Sequence: ${p.sequenceNumber} | Date: "${p.date}" | Name: "${p.name}" | Capacity: ${p.capacity} | Status: "${p.status}"`);
  });

  const subCount = await db.collection('submission').countDocuments({});
  console.log(`\n=== 'submission' collection has ${subCount} total documents ===`);

  const sampleSubs = await db.collection('submission').find({}).limit(5).toArray();
  console.log('Sample submissions:');
  sampleSubs.forEach(s => {
    console.log(`Inquiry: ${s.inquiryId} | Names: ${s.husbandName} & ${s.wifeName} | ProgramId: "${s.programId}" | ProgramDate: "${s.programDate}" | Status: "${s.status}"`);
  });

  const subProgramIds = await db.collection('submission').distinct('programId');
  console.log('\nDistinct programIds in submission collection:', subProgramIds);

  const subProgramDates = await db.collection('submission').distinct('programDate');
  console.log('Distinct programDates in submission collection:', subProgramDates);

  await mongoose.disconnect();
  process.exit(0);
}

run();
