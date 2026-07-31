import fs from 'fs';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(cell => cell.trim());
}

function extractUrl(val) {
  if (!val) return '';
  const match = val.match(/https?:\/\/[^\s"]+/);
  return match ? match[0] : val;
}

function run() {
  try {
    const csvContent = fs.readFileSync('/Users/macminim1/Downloads/submissions_export_2026-07-31.csv', 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    
    const header = parseCSVLine(lines[0]);
    console.log("Header columns:", header);
    
    const sample = parseCSVLine(lines[1]);
    console.log("Sample raw record:", sample);
    
    // Map sample to object
    const record = {
      inquiryId: sample[0],
      husbandName: sample[1],
      wifeName: sample[2],
      surname: sample[3],
      phoneNumber: sample[4],
      programId: sample[5],
      programName: sample[6],
      programDate: sample[7],
      programTime: sample[8],
      couplePhoto: extractUrl(sample[9]),
      paymentScreenshot: extractUrl(sample[10]),
      payeeNameFromReceipt: sample[11],
      status: sample[12],
      rejectionReason: sample[13],
      createdAt: sample[14]
    };
    
    console.log("Mapped record object:", record);
    
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
