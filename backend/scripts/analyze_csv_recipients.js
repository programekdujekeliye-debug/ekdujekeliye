import fs from 'fs';
import path from 'path';

const csvPath = path.resolve('..', 'CSV', 'EK DUJE KE LIYE-Replies-10-9-2026 19-55.csv');
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

console.log('Total lines:', lines.length);
console.log('Header:', lines[0]);

let totalRows = lines.length - 1;
let paidRows = 0;
let naRows = 0;
const phoneMapAll = new Map();
const phoneMapPaid = new Map();
let invalidPhone = 0;
const ticketTypes = {};

for (let i = 1; i < lines.length; i++) {
  const row = lines[i];
  const parts = [];
  let cur = '';
  let inQuotes = false;
  for (let j = 0; j < row.length; j++) {
    const ch = row[j];
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
  const partnerName = parts[4]?.replace(/^"|"$/g, '').trim();
  const regTime = parts[7]?.replace(/^"|"$/g, '').trim();
  const ticketName = parts[8]?.replace(/^"|"$/g, '').trim();
  const ticketId = parts[9]?.replace(/^"|"$/g, '').trim();
  const ticketAmount = parts[11]?.replace(/^"|"$/g, '').trim();

  ticketTypes[ticketName] = (ticketTypes[ticketName] || 0) + 1;

  if (phone.length > 10) phone = phone.slice(-10);

  const isPaid = ticketName && ticketName !== 'N/A';
  if (isPaid) paidRows++;
  else naRows++;

  if (!phone || phone.length !== 10 || /^0{10}$/.test(phone) || /^1{10}$/.test(phone)) {
    invalidPhone++;
  } else {
    if (!phoneMapAll.has(phone)) {
      phoneMapAll.set(phone, { name, partnerName, phone, ticketName, ticketId, isPaid });
    }
    if (isPaid && !phoneMapPaid.has(phone)) {
      phoneMapPaid.set(phone, { name, partnerName, phone, ticketName, ticketId });
    }
  }
}

console.log('\n--- Breakdown ---');
console.log('Ticket types breakdown:', ticketTypes);
console.log('Total rows (excluding header):', totalRows);
console.log('Paid rows (has ticket):', paidRows);
console.log('N/A rows (no ticket):', naRows);
console.log('Invalid phone rows:', invalidPhone);
console.log('Unique phone numbers (ALL valid rows):', phoneMapAll.size);
console.log('Unique phone numbers (PAID only):', phoneMapPaid.size);

// Sample first 5 names
console.log('\nFirst 5 recipients (All):', Array.from(phoneMapAll.values()).slice(0, 5));
