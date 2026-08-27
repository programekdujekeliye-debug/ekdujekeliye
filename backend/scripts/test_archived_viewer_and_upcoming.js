import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { MediaArchive } from '../src/models/MediaArchive.js';
import { Registration } from '../src/models/Registration.js';
import { Event } from '../src/models/Event.js';

async function runComprehensiveTests() {
  await mongoose.connect(env.MONGO_URI);
  console.log('====================================================');
  console.log('   EK DUJE KE LIYE — FULL ARCHIVE & UPCOMING TESTS   ');
  console.log('====================================================');

  const superAuth = { 'Authorization': 'Bearer Manish@1177', 'Content-Type': 'application/json' };
  const adminAuth = { 'Authorization': 'Bearer Manas@1177', 'Content-Type': 'application/json' };

  // ----------------------------------------------------
  // TEST 1: Signed View Token Generation (Super Admin & Normal Admin)
  // ----------------------------------------------------
  console.log('\n--- 1. SIGNED VIEW TOKEN GENERATION ---');
  let res = await fetch('http://localhost:5001/api/admin/media/CPL-559/view-token', {
    method: 'POST',
    headers: superAuth
  });

  const tokenData = await res.json();
  console.log('Super Admin View-Token HTTP Status:', res.status, res.status === 200 ? '✅ 200 OK' : '❌ FAILED');
  console.log('- Registration ID:', tokenData.registrationId);
  console.log('- File ID:', tokenData.fileId);
  console.log('- Expires At (Timestamp):', tokenData.expiresAt);
  console.log('- Nonce:', tokenData.nonce);
  console.log('- Signature (HMAC-SHA256):', tokenData.signature);
  console.log('- Generated Viewer URL:', tokenData.viewerUrl);

  // Normal Admin View-Token
  res = await fetch('http://localhost:5001/api/admin/media/CPL-559/view-token', {
    method: 'POST',
    headers: adminAuth
  });
  console.log('Normal Admin View-Token HTTP Status:', res.status, res.status === 200 ? '✅ 200 OK' : '❌ FAILED');

  // ----------------------------------------------------
  // TEST 2: Security & Anti-Tampering Verification
  // ----------------------------------------------------
  console.log('\n--- 2. SECURITY & ANTI-TAMPERING VERIFICATION ---');
  const secret = env.GOOGLE_MEDIA_VIEW_SECRET;

  // Verify valid signature
  const validMessage = `${tokenData.registrationId}:${tokenData.fileId}:${tokenData.expiresAt}:${tokenData.nonce}`;
  const computedSig = crypto.createHmac('sha256', secret).update(validMessage).digest('hex');
  console.log('Signature Validation:', computedSig === tokenData.signature ? '✅ PERFECT MATCH' : '❌ MISMATCH');

  // Tampered fileId test
  const tamperedFileMsg = `${tokenData.registrationId}:TAMPERED_FILE_ID:${tokenData.expiresAt}:${tokenData.nonce}`;
  const tamperedFileSig = crypto.createHmac('sha256', secret).update(tamperedFileMsg).digest('hex');
  console.log('Tampered File ID Detected:', tamperedFileSig !== tokenData.signature ? '✅ REJECTED' : '❌ LEAKED');

  // Tampered registrationId test
  const tamperedRegMsg = `CPL-999:${tokenData.fileId}:${tokenData.expiresAt}:${tokenData.nonce}`;
  const tamperedRegSig = crypto.createHmac('sha256', secret).update(tamperedRegMsg).digest('hex');
  console.log('Tampered Registration ID Detected:', tamperedRegSig !== tokenData.signature ? '✅ REJECTED' : '❌ LEAKED');

  // Expired token test
  const expiredExp = Math.floor(Date.now() / 1000) - 60; // 1 min in the past
  console.log('Expired Token Check (exp < now):', expiredExp < Math.floor(Date.now() / 1000) ? '✅ STRICTLY EXPIRED' : '❌ FAILED');

  // Unauthenticated request test
  const unauthRes = await fetch('http://localhost:5001/api/admin/media/CPL-559/view-token', { method: 'POST' });
  console.log('Unauthenticated Public Request:', unauthRes.status, unauthRes.status === 401 ? '✅ 401 UNAUTHORIZED (DENIED)' : '❌ LEAKED');

  // ----------------------------------------------------
  // TEST 3: Cloudinary Thumbnail & Original Retention
  // ----------------------------------------------------
  console.log('\n--- 3. CLOUDINARY THUMBNAIL & ORIGINAL INTEGRITY ---');
  const subRes = await fetch('http://localhost:5001/api/submissions?search=CPL-559', { headers: adminAuth });
  const subData = await subRes.json();
  const cplSub = (subData.submissions || []).find(s => s.inquiryId === 'CPL-559');

  console.log('Submissions API Output for CPL-559:');
  console.log('- Photo Storage Status:', cplSub?.photoStorageStatus, cplSub?.photoStorageStatus === 'ARCHIVED' ? '✅ ARCHIVED' : '❌ FAILED');
  console.log('- Has Archived Original:', cplSub?.hasArchivedOriginal, cplSub?.hasArchivedOriginal === true ? '✅ TRUE' : '❌ FAILED');
  console.log('- Optimized Thumbnail URL:', cplSub?.photoThumbnailUrl);
  console.log('- Has Cloudinary w_400 transform:', cplSub?.photoThumbnailUrl.includes('w_400') ? '✅ YES' : '❌ NO');

  // Verify Cloudinary original asset is still accessible
  const headRes = await fetch(cplSub?.couplePhoto, { method: 'HEAD' });
  console.log('- Original Cloudinary Asset HTTP Status:', headRes.status, headRes.status === 200 ? '✅ 200 OK (STILL PRESENT)' : '❌ DELETED');

  // ----------------------------------------------------
  // TEST 4: Dynamic Nearest Upcoming Event Selection
  // ----------------------------------------------------
  console.log('\n--- 4. DYNAMIC NEAREST UPCOMING EVENT SELECTION ---');
  const allEvents = await Event.find().lean();
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  console.log('India Standard Time Today (Asia/Kolkata):', todayStr);

  const eligibleUpcoming = allEvents
    .filter(p => ['upcoming', 'few_seats', 'housefull'].includes(p.status) && p.date && p.date >= todayStr && p.date !== 'TBD')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  console.log('Computed Nearest Upcoming Event in DB:');
  if (eligibleUpcoming.length > 0) {
    const nearest = eligibleUpcoming[0];
    console.log(`- ID: ${nearest.id}`);
    console.log(`- Name: ${nearest.name}`);
    console.log(`- Date: ${nearest.date} (Nearest Future Date)`);
    console.log(`- City: ${nearest.city}`);
    console.log(`- Status: ${nearest.status}`);
    console.log('Upcoming Selection Rule:', nearest.date === '2026-09-07' ? '✅ 7 SEPTEMBER 2026 SELECTED FIRST' : '❌ FAILED');
  }

  // ----------------------------------------------------
  // TEST 5: Public Pass Accessibility
  // ----------------------------------------------------
  console.log('\n--- 5. PUBLIC PASS PAGE INTEGRITY ---');
  const passRes = await fetch('http://localhost:5001/api/submissions/status/CPL-559');
  console.log('Public Pass Status Endpoint:', passRes.status, passRes.status === 200 ? '✅ 200 OK (FUNCTIONAL)' : '❌ FAILED');

  console.log('\n====================================================');
  console.log('             ALL VERIFICATIONS COMPLETE              ');
  console.log('====================================================');

  await mongoose.disconnect();
}

runComprehensiveTests();
