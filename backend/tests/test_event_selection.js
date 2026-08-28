/**
 * EDKL Public Event Selection Unit Test Suite
 * Validates the exact 2-future max algorithm and Asia/Kolkata start datetime logic
 */

import { parseEventStartTimestamp } from '../src/modules/events/event.service.js';

function selectUpcomingEvents(events, now = new Date()) {
  if (!events || events.length === 0) return [];

  // Filter out archived, completed, or inactive
  const validEvents = events.filter(e => {
    if (e.status === 'archived' || e.status === 'completed' || e.isActive === false) return false;
    return true;
  });

  // 1. Calculate start datetime for dated events and filter future events
  const datedEventsWithTime = validEvents
    .filter(e => {
      if (!e.date || e.date === 'TBA' || e.date === 'TBD' || e.isDateFinal === false || e.status === 'date_tba') {
        return false;
      }
      return true;
    })
    .map(e => {
      const startAt = parseEventStartTimestamp(e.date, e.time);
      return { ...e, eventStartAt: startAt };
    })
    .filter(e => e.eventStartAt && e.eventStartAt.getTime() > now.getTime())
    .sort((a, b) => a.eventStartAt.getTime() - b.eventStartAt.getTime() || (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

  let selectedEvents = [];

  if (datedEventsWithTime.length >= 1) {
    // Step 2 & 4: Return ONLY future dated events, max 2 (DO NOT append TBD)
    selectedEvents = datedEventsWithTime.slice(0, 2);
  } else {
    // Step 5: ONLY when future dated count = 0, query valid published TBD events (max 2)
    const tbdEvents = validEvents
      .filter(e => {
        return e.date === 'TBA' || e.date === 'TBD' || e.isDateFinal === false || !e.date || e.status === 'date_tba';
      })
      .sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0))
      .slice(0, 2);

    selectedEvents = tbdEvents;
  }

  return selectedEvents;
}

function runTests() {
  console.log('====================================================');
  console.log('EDKL PUBLIC EVENT SELECTION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // Fixed reference point: 2026-09-01 12:00:00 UTC (17:30 IST)
  const now = new Date('2026-09-01T12:00:00Z');

  const future1 = { id: 'fut-1', name: 'Future Event 1', date: '2026-09-05', time: '8:30 PM', sequenceNumber: 1, status: 'upcoming', isActive: true };
  const future2 = { id: 'fut-2', name: 'Future Event 2', date: '2026-09-12', time: '8:30 PM', sequenceNumber: 2, status: 'upcoming', isActive: true };
  const future3 = { id: 'fut-3', name: 'Future Event 3', date: '2026-09-20', time: '8:30 PM', sequenceNumber: 3, status: 'upcoming', isActive: true };
  const tbd1 = { id: 'tbd-1', name: 'TBD Event 1', date: 'TBA', isDateFinal: false, sequenceNumber: 10, status: 'date_tba', isActive: true };
  const past1 = { id: 'past-1', name: 'Past Event 1', date: '2026-08-20', time: '8:30 PM', sequenceNumber: 0, status: 'completed', isActive: true };
  const futureUnpublished = { id: 'fut-unpub', name: 'Future Unpub', date: '2026-09-06', time: '8:30 PM', status: 'upcoming', isActive: false };

  // CASE A: 3 future + 1 TBD -> Expected: first 2 future only
  {
    const res = selectUpcomingEvents([future1, future2, future3, tbd1], now);
    const pass = res.length === 2 && res[0].id === 'fut-1' && res[1].id === 'fut-2';
    if (pass) {
      console.log('✓ CASE A PASS: 3 future + 1 TBD returned exactly first 2 future events');
      passed++;
    } else {
      console.error('✗ CASE A FAIL:', res);
      failed++;
    }
  }

  // CASE B: 1 future + 1 TBD -> Expected: 1 future only (zero TBD filler)
  {
    const res = selectUpcomingEvents([future1, tbd1], now);
    const pass = res.length === 1 && res[0].id === 'fut-1';
    if (pass) {
      console.log('✓ CASE B PASS: 1 future + 1 TBD returned only the 1 future event (no TBD filler)');
      passed++;
    } else {
      console.error('✗ CASE B FAIL:', res);
      failed++;
    }
  }

  // CASE C: 0 future + 1 TBD -> Expected: TBD
  {
    const res = selectUpcomingEvents([tbd1], now);
    const pass = res.length === 1 && res[0].id === 'tbd-1';
    if (pass) {
      console.log('✓ CASE C PASS: 0 future + 1 TBD returned TBD event');
      passed++;
    } else {
      console.error('✗ CASE C FAIL:', res);
      failed++;
    }
  }

  // CASE D: 0 future + 0 TBD -> Expected: []
  {
    const res = selectUpcomingEvents([], now);
    const pass = Array.isArray(res) && res.length === 0;
    if (pass) {
      console.log('✓ CASE D PASS: 0 future + 0 TBD returned empty array');
      passed++;
    } else {
      console.error('✗ CASE D FAIL:', res);
      failed++;
    }
  }

  // CASE E: Past + TBD -> Expected: TBD
  {
    const res = selectUpcomingEvents([past1, tbd1], now);
    const pass = res.length === 1 && res[0].id === 'tbd-1';
    if (pass) {
      console.log('✓ CASE E PASS: Past + TBD returned TBD event');
      passed++;
    } else {
      console.error('✗ CASE E FAIL:', res);
      failed++;
    }
  }

  // CASE F: Past only -> Expected: []
  {
    const res = selectUpcomingEvents([past1], now);
    const pass = Array.isArray(res) && res.length === 0;
    if (pass) {
      console.log('✓ CASE F PASS: Past only returned empty array');
      passed++;
    } else {
      console.error('✗ CASE F FAIL:', res);
      failed++;
    }
  }

  // CASE G: Future unpublished + past + TBD -> Expected: TBD
  {
    const res = selectUpcomingEvents([futureUnpublished, past1, tbd1], now);
    const pass = res.length === 1 && res[0].id === 'tbd-1';
    if (pass) {
      console.log('✓ CASE G PASS: Future unpublished + past + TBD returned TBD event');
      passed++;
    } else {
      console.error('✗ CASE G FAIL:', res);
      failed++;
    }
  }

  console.log('\n====================================================');
  console.log(`PUBLIC EVENT SELECTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
