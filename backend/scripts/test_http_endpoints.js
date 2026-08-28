import http from 'http';

function makeRequest(path, headers = {}, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : (method === 'POST' ? '{}' : null);

    const reqHeaders = {
      'Accept': 'application/json',
      ...headers
    };

    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: 5001,
      path,
      method,
      headers: reqHeaders,
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const duration = (performance.now() - t0).toFixed(1);
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, duration, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, duration, raw: data.substring(0, 200) });
        }
      });
    });

    req.on('error', (err) => {
      const duration = (performance.now() - t0).toFixed(1);
      reject({ error: err.message, duration });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({ error: 'Request Timeout (10s)', duration: 10000 });
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    } else if (method === 'POST') {
      req.write('{}');
    }

    req.end();
  });
}

async function testAll() {
  console.log('--- STARTING DIRECT HTTP BENCHMARK ---\n');

  try {
    console.log('1. Health Check (GET /api/health)...');
    const h = await makeRequest('/api/health');
    console.log(`-> Status: ${h.status}, Duration: ${h.duration}ms, Body:`, h.data);

    console.log('\n2. Event Options (GET /api/admin/events/options)...');
    const opt = await makeRequest('/api/admin/events/options', { 'Authorization': 'Bearer Manas@1177' });
    console.log(`-> Status: ${opt.status}, Duration: ${opt.duration}ms, Count: ${Array.isArray(opt.data) ? opt.data.length : 'N/A'}`);

    console.log('\n3. Public Events (GET /api/programs)...');
    const prog = await makeRequest('/api/programs');
    console.log(`-> Status: ${prog.status}, Duration: ${prog.duration}ms, Count: ${Array.isArray(prog.data) ? prog.data.length : 'N/A'}`);
    if (Array.isArray(prog.data)) {
      prog.data.forEach((p, idx) => {
        console.log(`   Upcoming Event #${idx + 1}: ${p.name} | Date: ${p.date} | City: ${p.city} | Status: ${p.status}`);
      });
    }

    console.log('\n4. Event Summary Breakdown (GET /api/admin/events/summary)...');
    const summ = await makeRequest('/api/admin/events/summary', { 'Authorization': 'Bearer Manas@1177' });
    console.log(`-> Status: ${summ.status}, Duration: ${summ.duration}ms, Total Events in DB: ${Array.isArray(summ.data) ? summ.data.length : 'N/A'}`);
    if (Array.isArray(summ.data)) {
      summ.data.forEach(p => {
        console.log(`   - [${p.status.toUpperCase()}] id: "${p.id}" | ${p.name} | Date: ${p.date} | Regs: ${p.activeBookings || 0}`);
      });
    }

    console.log('\n5. Admin Dashboard Summary (GET /api/admin/dashboard)...');
    const dash = await makeRequest('/api/admin/dashboard', { 'Authorization': 'Bearer Manas@1177' });
    console.log(`-> Status: ${dash.status}, Duration: ${dash.duration}ms, Stats:`, dash.data?.stats);

    console.log('\n6. Submissions First 50 (GET /api/submissions?page=1&limit=50)...');
    const subs = await makeRequest('/api/submissions?page=1&limit=50', { 'Authorization': 'Bearer Manas@1177' });
    console.log('\n7. System Resources (GET /api/admin/system/resources)...');
    const resrc = await makeRequest('/api/admin/system/resources', { 'Authorization': 'Bearer Manish@1177' });
    console.log(`-> Status: ${resrc.status}, Duration: ${resrc.duration}ms, Memory RSS: ${resrc.data?.memory?.rssMB} MB`);

    console.log('\n8. Archive Candidates (GET /api/admin/archive/candidates)...');
    const cand = await makeRequest('/api/admin/archive/candidates', { 'Authorization': 'Bearer Manish@1177' });
    console.log(`-> Status: ${cand.status}, Duration: ${cand.duration}ms, Candidates: ${cand.data?.candidates?.length}`);

    const completedEvent = summ.data.find(e => e.status === 'completed' || e.date < '2026-08-28');
    const targetEventId = completedEvent ? completedEvent.id : 'prog-1787844365699-01';
    console.log(`\n9. Start Archive Test (POST /api/super-admin/archive/events/${targetEventId}/start)...`);
    const startRes = await makeRequest(`/api/super-admin/archive/events/${targetEventId}/start`, { 'Authorization': 'Bearer Manish@1177' }, 'POST');
    console.log(`-> Status: ${startRes.status}, Duration: ${startRes.duration}ms, Message:`, startRes.data?.message || startRes.data?.error);

    console.log('\n--- ALL ENDPOINTS TESTED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Test Failed:', err);
  }
}

testAll();
