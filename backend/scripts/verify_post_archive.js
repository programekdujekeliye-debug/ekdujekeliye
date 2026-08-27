import mongoose from 'mongoose';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { Registration } from '../src/models/Registration.js';
import { env } from '../src/config/env.js';

async function verifyAllIntegrity() {
  await mongoose.connect(env.MONGO_URI);
  console.log('=== COMPREHENSIVE POST-ARCHIVE VERIFICATION ===');

  // 1. MediaArchive state
  const job = await MediaArchive.findById('6a90bb161ca7a2fb4ec9463f').lean();
  console.log('\n1. MongoDB MediaArchive Record:');
  console.log('- Status:', job?.status, job?.status === 'VERIFIED' ? '✅ VERIFIED' : '❌ Failed');
  console.log('- Drive File ID:', job?.driveFileId);
  console.log('- Drive Folder ID:', job?.driveFolderId);
  console.log('- Verified At:', job?.verifiedAt);
  console.log('- File Size:', job?.originalSize, 'bytes');
  console.log('- Attempts:', job?.attempts);
  console.log('- Source URL preserved:', job?.sourceUrl);

  // 2. Cloudinary Original
  const headRes = await fetch(job.sourceUrl, { method: 'HEAD' });
  console.log('\n2. Cloudinary Original Asset Check:');
  console.log('- URL:', job.sourceUrl);
  console.log('- HTTP Status:', headRes.status, headRes.status === 200 ? '✅ 200 OK (STILL PRESENT)' : '❌ DELETED');

  // 3. Registration record in DB
  const reg = await Registration.findOne({ inquiryId: 'CPL-559' }).lean();
  console.log('\n3. Registration Record Check:');
  console.log('- Inquiry ID:', reg?.inquiryId);
  console.log('- Names:', reg?.husbandName, '&', reg?.wifeName, reg?.surname);
  console.log('- Couple Photo in DB:', reg?.couplePhoto);

  // 4. Global Queue breakdown
  const queued = await MediaArchive.countDocuments({ status: 'QUEUED' });
  const copying = await MediaArchive.countDocuments({ status: 'COPYING' });
  const verified = await MediaArchive.countDocuments({ status: 'VERIFIED' });
  const failed = await MediaArchive.countDocuments({ status: 'FAILED' });

  console.log('\n4. Global Queue Breakdown:');
  console.log('- QUEUED:', queued);
  console.log('- COPYING:', copying);
  console.log('- VERIFIED:', verified);
  console.log('- FAILED:', failed);

  const tbdQueued = await MediaArchive.countDocuments({ eventId: 'prog-1785924307713', status: 'QUEUED' });
  console.log('- Unrelated TBD Event QUEUED count:', tbdQueued, tbdQueued === 321 ? '✅ EXACTLY 321 (UNTOUCHED)' : '❌ CHANGED');

  // 5. Test Pass endpoint
  try {
    const passRes = await fetch('http://localhost:5001/api/public/pass/CPL-559');
    console.log('\n5. Public Pass API Check (/api/public/pass/CPL-559):');
    console.log('- HTTP Status:', passRes.status, passRes.status === 200 ? '✅ 200 OK (PASS FUNCTIONAL)' : 'Status: ' + passRes.status);
    if (passRes.status === 200) {
      const passData = await passRes.json();
      console.log('- Pass Inquirer:', passData.registration?.husbandName, '&', passData.registration?.wifeName);
      console.log('- Pass Photo URL:', passData.registration?.couplePhoto);
    }
  } catch (err) {
    console.log('Pass API check error:', err.message);
  }

  // 6. Test Admin Registrations endpoint
  try {
    const adminRes = await fetch('http://localhost:5001/api/registrations?search=CPL-559', {
      headers: { Authorization: 'Manas@1177' }
    });
    console.log('\n6. Admin Registrations API Check:');
    console.log('- HTTP Status:', adminRes.status, adminRes.status === 200 ? '✅ 200 OK (ADMIN PHOTO FUNCTIONAL)' : 'Status: ' + adminRes.status);
    if (adminRes.status === 200) {
      const adminData = await adminRes.json();
      const list = adminData.registrations || adminData || [];
      const found = Array.isArray(list) ? list.find(r => r.inquiryId === 'CPL-559') : null;
      console.log('- Admin Found CPL-559:', found ? 'YES' : 'NO');
      console.log('- Admin Photo URL:', found?.couplePhoto);
    }
  } catch (err) {
    console.log('Admin API check error:', err.message);
  }

  await mongoose.disconnect();
}

verifyAllIntegrity();
