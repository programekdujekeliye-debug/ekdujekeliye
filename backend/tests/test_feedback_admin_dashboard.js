import mongoose from 'mongoose';
import http from 'http';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Feedback } from '../src/models/Feedback.js';
import { Registration } from '../src/models/Registration.js';

async function runFeedbackAdminTests() {
  console.log('================================================================');
  console.log('EDKL — SUPER ADMIN FEEDBACK DASHBOARD & API TEST SUITE');
  console.log('================================================================\n');

  if (env.APP_ENV !== 'development' || env.DATABASE_NAME !== 'ekdujekeliye_test') {
    throw new Error(`[SAFETY GUARD] Cannot run test on database: ${env.DATABASE_NAME}`);
  }

  await mongoose.connect(env.MONGO_URI);

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failed++;
    }
  }

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const testInquiryId = `TEST-FB-${Date.now()}`;
  const testEventId = 'prog-test-feedback-2026';

  try {
    // 0. Seed test registration & feedback
    await Registration.create({
      inquiryId: testInquiryId,
      husbandName: 'Keval',
      wifeName: 'Dhara',
      surname: 'Patel',
      phoneNumber: '919876543210',
      programId: testEventId,
      programName: 'Ek Duje Ke Liye Special Test',
      programDate: '2026-09-07',
      status: 'approved',
      attendance: 'marked'
    });

    const testFeedback = await Feedback.create({
      inquiryId: testInquiryId,
      eventId: testEventId,
      token: `token-${testInquiryId}`,
      coupleName: 'Keval & Dhara Patel',
      overallRating: 5,
      venueRating: 5,
      wouldRecommend: true,
      feedbackText: 'Our marriage bond has deepened immensely after this seminar. Highly recommended!',
      keyTakeaways: ['communication', 'appreciation'],
      connectionRating: 'MUCH_CLOSER',
      isTestimonialAllowed: true,
      isSubmitted: true,
      submittedAt: new Date()
    });

    console.log('--- TEST 1: Auth Security & Protected Endpoints ---');
    const resNoAuth = await fetch(`${baseUrl}/api/feedback/admin/stats`);
    assert(resNoAuth.status === 401, 'Unauthorized request without token returns 401');

    const resAdminStats = await fetch(`${baseUrl}/api/feedback/admin/stats?eventId=${testEventId}`, {
      headers: { Authorization: `Bearer ${env.ADMIN_PASSWORD}` }
    });
    assert(resAdminStats.status === 200, 'Admin password authorized for stats (200 OK)');
    const statsData = await resAdminStats.json();
    assert(statsData.success === true, 'Stats response returns success true');
    assert(statsData.stats.totalSubmitted >= 1, 'Total submitted counts test feedback');
    assert(statsData.stats.averageOverallRating >= 4.0, 'Average overall rating computed correctly');
    assert(statsData.stats.connectionBreakdown.MUCH_CLOSER >= 1, 'Connection breakdown contains MUCH_CLOSER');
    assert(statsData.stats.takeawaysFrequency.communication >= 1, 'Takeaways frequency tracked');

    console.log('\n--- TEST 2: Feedback List, Search & Registration Enrichment ---');
    const resList = await fetch(`${baseUrl}/api/feedback/admin/list?eventId=${testEventId}&search=Keval`, {
      headers: { Authorization: `Bearer ${env.SUPER_ADMIN_PASSWORD}` }
    });
    assert(resList.status === 200, 'Super admin authorized for list (200 OK)');
    const listData = await resList.json();
    assert(listData.success === true, 'List response returns success true');
    assert(listData.data.length >= 1, 'Found at least 1 record matching search');
    const foundItem = listData.data.find(d => d.inquiryId === testInquiryId);
    assert(Boolean(foundItem), 'Found test feedback item in list');
    assert(foundItem.phoneNumber === '919876543210', 'Registration phone number successfully enriched');
    assert(foundItem.attendance === 'marked', 'Registration attendance status successfully enriched');

    console.log('\n--- TEST 3: Toggle Testimonial Permission ---');
    const resToggle = await fetch(`${baseUrl}/api/feedback/admin/${testFeedback._id}/toggle-testimonial`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.ADMIN_PASSWORD}` }
    });
    assert(resToggle.status === 200, 'Toggle testimonial returns 200 OK');
    const toggleData = await resToggle.json();
    assert(toggleData.isTestimonialAllowed === false, 'Toggled from true to false');

    console.log('\n--- TEST 4: Export Feedback Data (CSV & JSON) ---');
    const resExportJson = await fetch(`${baseUrl}/api/feedback/admin/export?eventId=${testEventId}&format=json`, {
      headers: { Authorization: `Bearer ${env.SUPER_ADMIN_PASSWORD}` }
    });
    assert(resExportJson.status === 200, 'JSON export returns 200 OK');
    const exportJson = await resExportJson.json();
    assert(Array.isArray(exportJson) && exportJson.length >= 1, 'Exported JSON array with records');

    const resExportCsv = await fetch(`${baseUrl}/api/feedback/admin/export?eventId=${testEventId}&format=csv`, {
      headers: { Authorization: `Bearer ${env.SUPER_ADMIN_PASSWORD}` }
    });
    assert(resExportCsv.status === 200, 'CSV export returns 200 OK');
    const exportCsv = await resExportCsv.text();
    assert(exportCsv.includes('Keval & Dhara Patel'), 'CSV contains couple name');

    console.log('\n--- TEST 5: Super Admin Delete Feedback Record ---');
    const resDelete = await fetch(`${baseUrl}/api/feedback/admin/${testFeedback._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.SUPER_ADMIN_PASSWORD}` }
    });
    assert(resDelete.status === 200, 'Super admin delete returns 200 OK');
    const verifyDeleted = await Feedback.findById(testFeedback._id);
    assert(verifyDeleted === null, 'Record verified removed from MongoDB');

  } finally {
    // Clean up
    await Feedback.deleteMany({ inquiryId: testInquiryId });
    await Registration.deleteMany({ inquiryId: testInquiryId });
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n================================================================');
  console.log(`FEEDBACK ADMIN RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runFeedbackAdminTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
