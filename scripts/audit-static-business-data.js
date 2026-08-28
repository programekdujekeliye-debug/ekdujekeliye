#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const scanDirectories = [
  path.join(rootDir, 'frontend', 'src', 'app'),
  path.join(rootDir, 'frontend', 'src', 'components'),
  path.join(rootDir, 'frontend', 'src', 'features'),
  path.join(rootDir, 'backend', 'src', 'modules'),
  path.join(rootDir, 'backend', 'src', 'app.js')
];

// Patterns that represent hardcoded business data in production code
const SUSPICIOUS_PATTERNS = [
  { name: 'Hardcoded Mock Programs Array', regex: /const\s+INITIAL_PROGRAMS\s*[:=]/i },
  { name: 'Hardcoded Production Event ID', regex: /['"`]prog-\d{10,}['"`]/ },
  { name: 'Hardcoded Production Inquiry ID', regex: /['"`]CPL-\d{3,}['"`]/ },
  { name: 'Hardcoded Specific Venue Name', regex: /['"`]Sardar Patel Smruti Bhavan[^'"`]*['"`]/i }
];

let totalIssues = 0;

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relPath = path.relative(rootDir, filePath);

  SUSPICIOUS_PATTERNS.forEach(pattern => {
    if (pattern.regex.test(content)) {
      console.error(`[AUDIT VIOLATION] ${pattern.name} found in: ${relPath}`);
      totalIssues++;
    }
  });
}

function scanDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const stat = fs.statSync(dirPath);
  if (stat.isFile()) {
    scanFile(dirPath);
    return;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(tsx|ts|js|jsx)$/.test(entry.name) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
      scanFile(fullPath);
    }
  }
}

console.log('--- EDKL STATIC BUSINESS DATA AUDIT ---');
console.log('Scanning production frontend and backend source directories...');

scanDirectories.forEach(dir => scanDir(dir));

if (totalIssues === 0) {
  console.log('PASSED: Zero hardcoded business data violations detected in production code.');
  process.exit(0);
} else {
  console.error(`FAILED: ${totalIssues} static business data violation(s) detected.`);
  process.exit(1);
}
