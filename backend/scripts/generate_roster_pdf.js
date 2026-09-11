import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PROD_URI = (process.env.PROD_MONGO_URI || process.env.MONGO_URI);

function extractNumericToken(token) {
  if (!token) return 0;
  const match = token.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function bucketByTokenRange(items, bucketSize = 50) {
  if (!items || items.length === 0) return [];
  const sorted = [...items].sort((a, b) => extractNumericToken(a.inquiryId) - extractNumericToken(b.inquiryId));
  const maxToken = Math.max(...sorted.map(s => extractNumericToken(s.inquiryId)));

  const buckets = [];
  for (let start = 1; start <= maxToken; start += bucketSize) {
    const end = start + bucketSize - 1;
    const inRange = sorted.filter(s => {
      const n = extractNumericToken(s.inquiryId);
      return n >= start && n <= end;
    });

    if (inRange.length > 0) {
      buckets.push({ rangeStart: start, rangeEnd: end, items: inRange });
    }
  }
  return buckets;
}

async function run() {
  const conn = await mongoose.createConnection(PROD_URI).asPromise();
  const regColl = conn.collection('submission');
  const programColl = conn.collection('program');

  const prog = await programColl.findOne({ id: 'prog-2026-09-07' });
  const eventIds = ['prog-2026-09-07', prog?.slug, '2026-09-07'];

  const allApproved = await regColl.find({
    $and: [
      {
        $or: [
          { programId: { $in: eventIds } },
          { programDate: '2026-09-07' }
        ]
      },
      { isDeleted: { $ne: true } },
      {
        $or: [{ status: 'approved' }, { 'payment.status': 'captured' }]
      }
    ]
  }).toArray();

  console.log(`Found ${allApproved.length} attendees.`);

  // 1. Separate into Regular and IP
  const regularList = allApproved.filter(r => !r.inquiryId?.includes('IP'));
  const ipList = allApproved.filter(r => r.inquiryId?.includes('IP'));

  // 2. Bucket by Token Range (1-50, 51-100, 101-150, etc.)
  const regularBuckets = bucketByTokenRange(regularList, 50);
  const ipBuckets = bucketByTokenRange(ipList, 50);

  const totalPages = regularBuckets.length + ipBuckets.length;
  console.log(`Regular Buckets: ${regularBuckets.length} pages`);
  console.log(`IP Buckets     : ${ipBuckets.length} pages`);
  console.log(`Total Pages    : ${totalPages} pages`);

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Ek Duje Ke Liye (2026-09-07)</title>
<style>
  @page {
    size: A4 portrait;
    margin: 8mm 8mm 8mm 8mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 10px;
  }
  .page {
    width: 100%;
    height: 280mm;
    max-height: 280mm;
    page-break-after: always;
    break-after: page;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    overflow: hidden;
  }
  .page:last-child {
    page-break-after: avoid;
    break-after: avoid;
  }
  .header {
    border-bottom: 2px solid #be123c;
    padding-bottom: 4px;
    margin-bottom: 5px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .header-left h1 {
    margin: 0;
    font-size: 15px;
    font-weight: 900;
    color: #881337;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .header-left p {
    margin: 2px 0 0 0;
    font-size: 9.5px;
    color: #475569;
    font-weight: 600;
  }
  .header-right {
    text-align: right;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .badge-regular {
    background-color: #ffe4e6;
    color: #9f1239;
    border: 1px solid #fecdd3;
  }
  .badge-ip {
    background-color: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
  }
  .page-info {
    font-size: 9px;
    color: #64748b;
    font-weight: 700;
    margin-top: 2px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th {
    background-color: #f1f5f9;
    color: #0f172a;
    font-weight: 800;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 3.5px 6px;
    border: 1px solid #94a3b8;
    text-align: left;
  }
  td {
    padding: 2.6px 6px;
    border: 1px solid #cbd5e1;
    font-size: 9.5px;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  tr:nth-child(even) {
    background-color: #f8fafc;
  }
  .col-token {
    width: 20%;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 800;
    text-align: center;
  }
  .token-regular {
    color: #be123c;
  }
  .token-ip {
    color: #b45309;
  }
  .col-husband {
    width: 24%;
    font-weight: 700;
    color: #0f172a;
  }
  .col-wife {
    width: 24%;
    font-weight: 700;
    color: #0f172a;
  }
  .col-surname {
    width: 16%;
    color: #334155;
    font-weight: 600;
  }
  .col-mobile {
    width: 16%;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    text-align: center;
    font-weight: 700;
    color: #1e293b;
  }
  .print-btn-bar {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 9999;
    background: #ffffff;
    padding: 8px 12px;
    border-radius: 10px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
    border: 1px solid #e2e8f0;
  }
  .print-btn {
    background: #be123c;
    color: #ffffff;
    border: none;
    padding: 8px 16px;
    font-weight: 800;
    font-size: 12px;
    border-radius: 6px;
    cursor: pointer;
  }
  @media print {
    .print-btn-bar {
      display: none !important;
    }
  }
</style>
</head>
<body>

<div class="print-btn-bar">
  <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF (${totalPages} Pages)</button>
</div>
`;

  let globalPageNum = 1;

  // Render Regular Section Pages by Token Range
  regularBuckets.forEach((bucket) => {
    html += `
  <div class="page">
    <div class="header">
      <div class="header-left">
        <h1>Ek Duje Ke Liye</h1>
        <p>Sardar Patel Smruti Bhavan, Surat &bull; 07-Sep-2026 (8:30 PM)</p>
      </div>
      <div class="header-right">
        <span class="badge badge-regular">TOKENS ${bucket.rangeStart} - ${bucket.rangeEnd} (${bucket.items.length})</span>
        <div class="page-info">Page ${globalPageNum} of ${totalPages}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="col-token" style="text-align: center;">Registration Number</th>
          <th class="col-husband">Husband Name</th>
          <th class="col-wife">Wife Name</th>
          <th class="col-surname">Surname</th>
          <th class="col-mobile" style="text-align: center;">Mobile Number</th>
        </tr>
      </thead>
      <tbody>
`;

    bucket.items.forEach((item) => {
      const husband = escapeHtml(item.husbandName || item.partner1Name || '-');
      const wife = escapeHtml(item.wifeName || item.partner2Name || '-');
      const surname = escapeHtml(item.surname && item.surname !== '.' ? item.surname : '');
      const phone = escapeHtml(item.phoneNumber || '-');
      const token = escapeHtml(item.inquiryId || '-');

      html += `
        <tr>
          <td class="col-token token-regular">${token}</td>
          <td class="col-husband">${husband}</td>
          <td class="col-wife">${wife}</td>
          <td class="col-surname">${surname}</td>
          <td class="col-mobile">${phone}</td>
        </tr>
`;
    });

    html += `
      </tbody>
    </table>
  </div>
`;
    globalPageNum++;
  });

  // Render IP Section Pages by Token Range
  ipBuckets.forEach((bucket) => {
    html += `
  <div class="page">
    <div class="header">
      <div class="header-left">
        <h1>Ek Duje Ke Liye</h1>
        <p>Sardar Patel Smruti Bhavan, Surat &bull; 07-Sep-2026 (8:30 PM)</p>
      </div>
      <div class="header-right">
        <span class="badge badge-ip">IP TOKENS ${bucket.rangeStart} - ${bucket.rangeEnd} (${bucket.items.length})</span>
        <div class="page-info">Page ${globalPageNum} of ${totalPages}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="col-token" style="text-align: center;">Registration Number</th>
          <th class="col-husband">Husband Name</th>
          <th class="col-wife">Wife Name</th>
          <th class="col-surname">Surname</th>
          <th class="col-mobile" style="text-align: center;">Mobile Number</th>
        </tr>
      </thead>
      <tbody>
`;

    bucket.items.forEach((item) => {
      const husband = escapeHtml(item.husbandName || item.partner1Name || '-');
      const wife = escapeHtml(item.wifeName || item.partner2Name || '-');
      const surname = escapeHtml(item.surname && item.surname !== '.' ? item.surname : '');
      const phone = escapeHtml(item.phoneNumber || '-');
      const token = escapeHtml(item.inquiryId || '-');

      html += `
        <tr>
          <td class="col-token token-ip">${token}</td>
          <td class="col-husband">${husband}</td>
          <td class="col-wife">${wife}</td>
          <td class="col-surname">${surname}</td>
          <td class="col-mobile">${phone}</td>
        </tr>
`;
    });

    html += `
      </tbody>
    </table>
  </div>
`;
    globalPageNum++;
  });

  html += `
</body>
</html>
`;

  const downloadsDir = 'C:\\Users\\jayne\\Downloads';
  const htmlFilePath = path.join(downloadsDir, 'Ek_Duje_Ke_Liye_2026-09-07_Attendance_Roster_50_per_page.html');
  const pdfFilePath = path.join(downloadsDir, 'Ek_Duje_Ke_Liye_2026-09-07_Attendance_Roster_50_per_page.pdf');

  fs.writeFileSync(htmlFilePath, html, 'utf-8');
  console.log('HTML file successfully written to:', htmlFilePath);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browserBinary = fs.existsSync(edgePath) ? edgePath : chromePath;

  console.log('Generating PDF using:', browserBinary);
  try {
    execSync(`"${browserBinary}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${pdfFilePath}" "${htmlFilePath}"`, {
      stdio: 'inherit'
    });
    console.log('PDF successfully generated at:', pdfFilePath);
    const stats = fs.statSync(pdfFilePath);
    console.log(`PDF File Size: ${(stats.size / 1024).toFixed(1)} KB`);
  } catch (pdfErr) {
    console.error('PDF generation error:', pdfErr.message);
  }

  await conn.close();
}

run().catch(console.error);
