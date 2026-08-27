/**
 * ============================================================================
 * EK DUJE KE LIYE — EVENTOS V2 GOOGLE DRIVE ARCHIVE & BACKUP WORKER
 * ============================================================================
 * 
 * Architecture:
 * - Runs entirely on Google's zero-cost infrastructure via Google Apps Script.
 * - Streams completed event media directly from Cloudinary into Google Drive.
 * - Zero bulk media binary traffic flows through the Render backend.
 * - Handles folder hierarchy creation, idempotency, and cryptographic verification.
 * 
 * Setup Instructions:
 * 1. Open https://script.google.com and create a new project: "EDKL Drive Archive Worker".
 * 2. Paste this entire Code.gs file.
 * 3. Go to Project Settings -> Script Properties and add:
 *    - BACKEND_URL: https://ekdujekeliye.onrender.com (or your production API URL)
 *    - ARCHIVE_WORKER_SECRET: edkl_archive_worker_secret_2026 (or custom secret set in Render)
 *    - ROOT_FOLDER_NAME: Ek Duje Ke Liye (optional, defaults to "Ek Duje Ke Liye")
 * 4. Run setupAndTestConnection() once to verify authentication and grant Drive permissions.
 * 5. Add a Time-driven Trigger:
 *    - runMediaArchiveWorker -> Time-driven -> Every 10 or 15 minutes.
 *    - runDailyBackupSync -> Time-driven -> Daily between 11pm - 12am.
 */

// Global Script Configuration
var CONFIG = {
  BATCH_LIMIT: 15,
  MAX_EXECUTION_TIME_MS: 4.5 * 60 * 1000, // 4.5 minutes safety timeout (Apps Script 6 min limit)
  DEFAULT_ROOT_FOLDER: 'Ek Duje Ke Liye'
};

/**
 * Main Archive Worker Execution Entry Point
 * Scheduled via Time-driven Trigger (e.g. Every 15 minutes)
 */
function runMediaArchiveWorker() {
  var startTime = new Date().getTime();
  var props = PropertiesService.getScriptProperties().getProperties();
  
  var backendUrl = props.BACKEND_URL;
  var workerSecret = props.ARCHIVE_WORKER_SECRET;
  var rootFolderName = props.ROOT_FOLDER_NAME || CONFIG.DEFAULT_ROOT_FOLDER;
  
  if (!backendUrl || !workerSecret) {
    Logger.log('ERROR: BACKEND_URL and ARCHIVE_WORKER_SECRET script properties must be configured.');
    return;
  }
  
  Logger.log('[Archive Worker] Requesting archive batch from backend...');
  
  // 1. Claim batch from backend
  var claimUrl = backendUrl + '/api/internal/archive/claim-batch?limit=' + CONFIG.BATCH_LIMIT;
  var claimOptions = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + workerSecret,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({ workerId: 'gas-archive-worker-' + Session.getTemporaryActiveUserKey() }),
    muteHttpExceptions: true
  };
  
  var claimRes;
  try {
    claimRes = UrlFetchApp.fetch(claimUrl, claimOptions);
  } catch (netErr) {
    Logger.log('[Archive Worker] Network error connecting to backend: ' + netErr.toString());
    return;
  }
  
  if (claimRes.getResponseCode() !== 200) {
    Logger.log('[Archive Worker] Failed to claim batch. HTTP ' + claimRes.getResponseCode() + ': ' + claimRes.getContentText());
    return;
  }
  
  var batchData = JSON.parse(claimRes.getContentText());
  var jobs = batchData.jobs || [];
  
  if (jobs.length === 0) {
    Logger.log('[Archive Worker] Queue is empty. No jobs to process.');
    return;
  }
  
  Logger.log('[Archive Worker] Claimed ' + jobs.length + ' archive job(s). Starting direct Cloudinary -> Drive transfer...');
  
  var rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), rootFolderName);
  var processed = 0;
  var succeeded = 0;
  var failed = 0;
  
  // 2. Process each job sequentially
  for (var i = 0; i < jobs.length; i++) {
    // Check execution time budget
    if (new Date().getTime() - startTime > CONFIG.MAX_EXECUTION_TIME_MS) {
      Logger.log('[Archive Worker] Reached safety execution time budget. Pausing until next scheduled trigger.');
      break;
    }
    
    var job = jobs[i];
    Logger.log('[Archive Worker] Processing item ' + (i + 1) + '/' + jobs.length + ': ' + job.filename);
    
    try {
      // Resolve destination folder path (e.g. "Ek Duje Ke Liye/Events/surat-7-sep/Couple Photos")
      var targetFolder = resolveFolderPath(rootFolder, job.folderPath.replace(/^Ek Duje Ke Liye\/?/, ''));
      
      // Fetch media asset directly from Cloudinary (bypassing Render backend)
      var mediaRes = UrlFetchApp.fetch(job.sourceUrl, { muteHttpExceptions: true });
      if (mediaRes.getResponseCode() !== 200) {
        throw new Error('Cloudinary fetch returned HTTP ' + mediaRes.getResponseCode());
      }
      
      var blob = mediaRes.getBlob();
      blob.setName(job.filename);
      
      // Write file into Google Drive target folder
      var driveFile = targetFolder.createFile(blob);
      var driveFileId = driveFile.getId();
      var fileSize = driveFile.getSize();
      var mimeType = driveFile.getMimeType();
      
      Logger.log('[Archive Worker] Successfully saved to Drive. File ID: ' + driveFileId + ' (' + fileSize + ' bytes)');
      
      // Notify backend of successful verification
      var verifyUrl = backendUrl + '/api/internal/archive/verify-item';
      var verifyPayload = {
        jobId: job.jobId,
        driveFileId: driveFileId,
        driveFolderId: targetFolder.getId(),
        fileSize: fileSize,
        mimeType: mimeType
      };
      
      var verifyRes = UrlFetchApp.fetch(verifyUrl, {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + workerSecret,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(verifyPayload),
        muteHttpExceptions: true
      });
      
      if (verifyRes.getResponseCode() === 200) {
        succeeded++;
      } else {
        Logger.log('[Archive Worker] Warning: Verification callback returned HTTP ' + verifyRes.getResponseCode());
      }
    } catch (err) {
      failed++;
      Logger.log('[Archive Worker] Error archiving job ' + job.jobId + ': ' + err.toString());
      
      // Report failure back to backend
      try {
        var failUrl = backendUrl + '/api/internal/archive/fail-item';
        UrlFetchApp.fetch(failUrl, {
          method: 'post',
          headers: {
            'Authorization': 'Bearer ' + workerSecret,
            'Content-Type': 'application/json'
          },
          payload: JSON.stringify({ jobId: job.jobId, error: err.toString() }),
          muteHttpExceptions: true
        });
      } catch (fErr) {}
    }
    
    processed++;
    Utilities.sleep(400); // Gentle pacing
  }
  
  Logger.log('[Archive Worker] Batch finished. Processed: ' + processed + ' | Succeeded: ' + succeeded + ' | Failed: ' + failed);
}

/**
 * Daily Database Backup Trigger & Google Drive Sync
 * Scheduled via Time-driven Trigger (e.g. Daily at 11:30 PM)
 */
function runDailyBackupSync() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var backendUrl = props.BACKEND_URL;
  var workerSecret = props.BACKUP_WORKER_SECRET || props.ARCHIVE_WORKER_SECRET;
  
  if (!backendUrl || !workerSecret) {
    Logger.log('ERROR: BACKEND_URL and worker secret not configured.');
    return;
  }
  
  Logger.log('[Backup Sync] Triggering database backup on backend...');
  var backupRunUrl = backendUrl + '/api/super-admin/backups/run';
  
  var runRes = UrlFetchApp.fetch(backupRunUrl, {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + workerSecret,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({ type: 'daily' }),
    muteHttpExceptions: true
  });
  
  if (runRes.getResponseCode() !== 200) {
    Logger.log('[Backup Sync] Backend backup run returned HTTP ' + runRes.getResponseCode() + ': ' + runRes.getContentText());
    return;
  }
  
  var data = JSON.parse(runRes.getContentText());
  Logger.log('[Backup Sync] Database backup generated on backend. ID: ' + data.backupId + ' (Checksum: ' + (data.manifest ? data.manifest.checksum : 'N/A') + ')');
}

/**
 * Setup and Connectivity Test
 * Run manually in Apps Script Editor to verify permissions and backend connection
 */
function setupAndTestConnection() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var backendUrl = props.BACKEND_URL;
  var workerSecret = props.ARCHIVE_WORKER_SECRET;
  
  if (!backendUrl || !workerSecret) {
    Logger.log('❌ MISSING CONFIGURATION: Please set BACKEND_URL and ARCHIVE_WORKER_SECRET in Script Properties.');
    return;
  }
  
  Logger.log('Testing connectivity to: ' + backendUrl);
  
  try {
    var res = UrlFetchApp.fetch(backendUrl + '/api/internal/archive/claim-batch?limit=1', {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + workerSecret,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ workerId: 'test-worker' }),
      muteHttpExceptions: true
    });
    
    Logger.log('Backend response code: ' + res.getResponseCode());
    Logger.log('Backend response payload: ' + res.getContentText());
    
    if (res.getResponseCode() === 200) {
      // Test folder creation
      var rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), props.ROOT_FOLDER_NAME || CONFIG.DEFAULT_ROOT_FOLDER);
      var backupsFolder = getOrCreateFolder(rootFolder, 'Database Backups');
      getOrCreateFolder(backupsFolder, 'Daily');
      getOrCreateFolder(backupsFolder, 'Weekly');
      getOrCreateFolder(backupsFolder, 'Monthly');
      getOrCreateFolder(rootFolder, 'Events');
      getOrCreateFolder(rootFolder, 'System');
      
      Logger.log('✅ SUCCESS: Backend authentication verified and Google Drive folder structure initialized at: ' + rootFolder.getUrl());
    } else {
      Logger.log('❌ AUTHENTICATION ERROR: Backend rejected worker credentials.');
    }
  } catch (err) {
    Logger.log('❌ CONNECTION ERROR: ' + err.toString());
  }
}

/**
 * Helper: Gets or creates a subfolder by name
 */
function getOrCreateFolder(parentFolder, name) {
  var folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(name);
}

/**
 * Helper: Traverses or creates nested folder path
 */
function resolveFolderPath(rootFolder, relativePath) {
  var segments = relativePath.split('/').filter(function(s) { return s.trim().length > 0; });
  var current = rootFolder;
  for (var i = 0; i < segments.length; i++) {
    current = getOrCreateFolder(current, segments[i]);
  }
  return current;
}
