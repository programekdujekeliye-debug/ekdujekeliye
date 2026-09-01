import { connectDatabase } from '../src/config/database.js';
import { Registration } from '../src/models/Registration.js';
import mongoose from 'mongoose';

async function listRegs() {
  await connectDatabase();
  const allRegs = await Registration.find({ isDeleted: { $ne: true } }).lean();
  console.log(`Total registrations: ${allRegs.length}`);
  allRegs.forEach(r => {
    console.log(`Inquiry: ${r.inquiryId} | Names: ${r.husbandName} & ${r.wifeName} | ProgramId: "${r.programId}" | ProgramDate: "${r.programDate}" | Status: ${r.status} | isVip: ${r.isVip}`);
  });
  await mongoose.disconnect();
  process.exit(0);
}

listRegs();
