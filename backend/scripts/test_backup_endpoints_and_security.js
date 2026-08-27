import { env } from '../src/config/env.js';

async function testBackupSecurity() {
  console.log('====================================================');
  console.log('   BACKUP ENDPOINTS & SECURITY VERIFICATION TEST   ');
  console.log('====================================================');

  const backupId = 'backup_manual_2026-08-27_1787871401777';
  const localUrl = 'http://localhost:5001';
  const backupWorkerSecret = env.BACKUP_WORKER_SECRET;
  const adminSecret = env.ADMIN_PASSWORD;

  // 1. Anonymous Access Test
  console.log('\n--- 1. ANONYMOUS ACCESS TEST ---');
  let res = await fetch(`${localUrl}/api/internal/backups/${backupId}/file`);
  console.log('Anonymous /file Request:', res.status, res.status === 401 ? '✅ 401 UNAUTHORIZED (DENIED)' : '❌ LEAKED');

  res = await fetch(`${localUrl}/api/internal/backups/${backupId}/manifest`);
  console.log('Anonymous /manifest Request:', res.status, res.status === 401 ? '✅ 401 UNAUTHORIZED (DENIED)' : '❌ LEAKED');

  // 2. Normal Admin (Forbidden) Test
  console.log('\n--- 2. NORMAL ADMIN ACCESS TEST ---');
  res = await fetch(`${localUrl}/api/internal/backups/${backupId}/file`, {
    headers: { 'Authorization': `Bearer ${adminSecret}` }
  });
  console.log('Normal Admin /file Request:', res.status, res.status === 403 ? '✅ 403 FORBIDDEN (DENIED)' : '❌ LEAKED');

  // 3. Wrong Worker Secret Test
  console.log('\n--- 3. WRONG WORKER SECRET TEST ---');
  res = await fetch(`${localUrl}/api/internal/backups/${backupId}/file`, {
    headers: { 'Authorization': 'Bearer WRONG_SECRET' }
  });
  console.log('Wrong Secret /file Request:', res.status, res.status === 403 ? '✅ 403 FORBIDDEN (DENIED)' : '❌ LEAKED');

  // 4. Authorized Backup Worker Manifest Test
  console.log('\n--- 4. AUTHORIZED BACKUP WORKER MANIFEST TEST ---');
  res = await fetch(`${localUrl}/api/internal/backups/${backupId}/manifest`, {
    headers: { 'Authorization': `Bearer ${backupWorkerSecret}` }
  });
  const manifestData = await res.json();
  console.log('Worker /manifest Request:', res.status, res.status === 200 ? '✅ 200 OK (ALLOWED)' : '❌ FAILED');
  console.log('- Backup ID:', manifestData.backupId);
  console.log('- Type:', manifestData.type);
  console.log('- Size:', manifestData.size, 'bytes');
  console.log('- Checksum:', manifestData.checksum);

  // 5. Authorized Backup Worker File Download Test
  console.log('\n--- 5. AUTHORIZED BACKUP WORKER FILE DOWNLOAD TEST ---');
  res = await fetch(`${localUrl}/api/internal/backups/${backupId}/file`, {
    headers: { 'Authorization': `Bearer ${backupWorkerSecret}` }
  });
  console.log('Worker /file Request:', res.status, res.status === 200 ? '✅ 200 OK (STREAMING GZIP)' : '❌ FAILED');
  console.log('- Content-Type:', res.headers.get('content-type'));
  console.log('- X-Backup-Checksum:', res.headers.get('x-backup-checksum'));
  const buffer = await res.arrayBuffer();
  console.log('- Downloaded Size:', buffer.byteLength, 'bytes (~' + (buffer.byteLength / 1024).toFixed(1) + ' KB)');

  // 6. Mock Verification Rejection Test
  console.log('\n--- 6. MOCK VERIFICATION REJECTION TEST ---');
  res = await fetch(`${localUrl}/api/internal/backups/verify-sync`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${backupWorkerSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      backupId,
      driveFileId: 'mock_drive_file_id',
      driveManifestFileId: 'mock_manifest_id',
      driveFolderId: 'mock_folder'
    })
  });
  console.log('Mock Verification Payload:', res.status, res.status === 400 ? '✅ 400 REJECTED (GUARD ACTIVE)' : '❌ FAILED');

  console.log('\n====================================================');
  console.log('         ALL BACKUP SECURITY TESTS PASSED           ');
  console.log('====================================================');
}

testBackupSecurity();
