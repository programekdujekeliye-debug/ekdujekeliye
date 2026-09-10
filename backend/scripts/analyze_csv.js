import fs from 'fs';
import path from 'path';

const csvPath = path.resolve('../CSV/EK DUJE KE LIYE-Replies-9-9-2026 23-01.csv');
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
const rows = lines.slice(1);

const phones = new Map();
let invalidCount = 0;

rows.forEach((row, idx) => {
  const parts = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);

  const name = parts[0]?.replace(/^"|"$/g, '').trim();
  const countryCode = parts[1]?.replace(/^"|"$/g, '').trim() || '91';
  let phone = parts[2]?.replace(/^"|"$/g, '').trim().replace(/\D/g, '');
  const wifeName = parts[4]?.replace(/^"|"$/g, '').trim();

  if (phone.length > 10) phone = phone.slice(-10);

  if (!phone || phone.length !== 10 || /^0{10}$/.test(phone) || /^1{10}$/.test(phone)) {
    invalidCount++;
  } else {
    if (!phones.has(phone)) {
      phones.set(phone, { name, wifeName, countryCode, phone });
    }
  }
});

console.log('Total data rows:', rows.length);
console.log('Valid unique phones:', phones.size);
console.log('Invalid phones:', invalidCount);
console.log('Sample 3 recipients:', Array.from(phones.values()).slice(0, 3));
