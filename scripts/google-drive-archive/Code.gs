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
 *    - ARCHIVE_WORKER_SECRET: 023176b693554f4439e2f67716e0760a8ff953c2aee2165dbd485237ab6297fe
 *    - GOOGLE_MEDIA_VIEW_SECRET: 9fb1ae65a72e7c03977af4cd252ce915652dc100df1732292d161b6adba47510
 *    - ROOT_FOLDER_NAME: Ek Duje Ke Liye (optional, defaults to "Ek Duje Ke Liye")
 *    - TARGET_TEST_JOB_ID: 6a90bb161ca7a2fb4ec9463f
 * 4. Run validateArchiveConfiguration() and testFolderResolution() to verify configuration.
 * 5. Add a Time-driven Trigger (only when mass archiving is officially scheduled):
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
 * ============================================================================
 * CONFIGURATION & DIAGNOSTIC FUNCTIONS
 * ============================================================================
 */

/**
 * Validates Script Properties existence without logging secret values.
 * Run in Apps Script Editor to verify setup.
 */
function validateArchiveConfiguration() {
  var props = PropertiesService.getScriptProperties().getProperties();
  
  Logger.log('====================================================');
  Logger.log('      EDKL ARCHIVE SCRIPT CONFIGURATION CHECK       ');
  Logger.log('====================================================');
  
  var userEmail = Session.getEffectiveUser().getEmail() || 'Unknown';
  Logger.log('👤 Active Google Account: ' + userEmail);
  
  Logger.log('BACKEND_URL: ' + (props.BACKEND_URL ? 'CONFIGURED' : 'MISSING ❌'));
  Logger.log('ARCHIVE_WORKER_SECRET: ' + (props.ARCHIVE_WORKER_SECRET ? 'CONFIGURED' : 'MISSING ❌'));
  Logger.log('BACKUP_WORKER_SECRET: ' + (props.BACKUP_WORKER_SECRET ? 'CONFIGURED' : 'OPTIONAL / NOT SET'));
  Logger.log('GOOGLE_MEDIA_VIEW_SECRET: ' + (props.GOOGLE_MEDIA_VIEW_SECRET ? 'CONFIGURED' : 'MISSING ❌'));
  Logger.log('ROOT_FOLDER_NAME: ' + (props.ROOT_FOLDER_NAME ? 'CONFIGURED (' + props.ROOT_FOLDER_NAME + ')' : 'DEFAULT (Ek Duje Ke Liye)'));
  Logger.log('ROOT_FOLDER_ID: ' + (props.ROOT_FOLDER_ID ? 'CONFIGURED' : 'NOT SET (Will be auto-cached on first run)'));
  Logger.log('TARGET_TEST_JOB_ID: ' + (props.TARGET_TEST_JOB_ID ? 'CONFIGURED' : 'MISSING / PASS VIA PARAM ⚠️'));
  Logger.log('TARGET_BACKUP_ID: ' + (props.TARGET_BACKUP_ID ? 'CONFIGURED' : 'OPTIONAL / PASS VIA PARAM ⚠️'));
  Logger.log('TARGET_ARCHIVE_EVENT_ID: ' + (props.TARGET_ARCHIVE_EVENT_ID ? 'CONFIGURED' : 'OPTIONAL / PASS VIA PARAM ⚠️'));
  
  Logger.log('====================================================');
}

/**
 * Diagnostic Function: Tests root folder access and path resolution safely.
 * Non-mutating (does NOT claim jobs or touch Cloudinary / registrations).
 */
function testFolderResolution() {
  Logger.log('====================================================');
  Logger.log('         TESTING FOLDER RESOLUTION LOGIC            ');
  Logger.log('====================================================');
  
  var userEmail = Session.getEffectiveUser().getEmail() || 'Unknown';
  Logger.log('👤 Active Google Account: ' + userEmail);
  
  try {
    // 1. Test Root Resolution
    var root = getArchiveRootFolder();
    Logger.log('Archive root accessible: YES');
    Logger.log('Root folder name: ' + root.getName());
    Logger.log('Root folder ID: ' + root.getId());
    Logger.log('Root folder URL: https://drive.google.com/drive/folders/' + root.getId());
    
    // 2. Test Path Resolution with test path
    var testPath = 'Ek Duje Ke Liye/Events/test-folder-resolution/Couple Photos';
    Logger.log('\nResolving test path: ' + testPath);
    var resolvedFolder = getOrCreateFolderPath(testPath);
    
    Logger.log('Target path resolved: YES');
    Logger.log('Final folder name: ' + resolvedFolder.getName());
    Logger.log('Final folder ID: ' + resolvedFolder.getId());
    
    // 3. Clean up the temporary test folder
    try {
      var eventsFolder = getOrCreateFolder(root, 'Events');
      var testFolders = eventsFolder.getFoldersByName('test-folder-resolution');
      while (testFolders.hasNext()) {
        var tf = testFolders.next();
        tf.setTrashed(true);
        Logger.log('Cleaned up temporary test folder: ' + tf.getName());
      }
    } catch (cleanErr) {
      Logger.log('Note on cleanup: ' + cleanErr.toString());
    }
    
    Logger.log('\n🎉 FOLDER RESOLUTION TEST RESULT: PASS');
  } catch (err) {
    Logger.log('❌ FOLDER RESOLUTION TEST FAILED: ' + err.toString());
  }
}

/**
 * ============================================================================
 * SAFE FOLDER MANAGEMENT HELPERS
 * ============================================================================
 */

/**
 * Resolves the primary Google Drive archive root folder safely.
 * Checks ROOT_FOLDER_ID in Script Properties first.
 * If not present or inaccessible, resolves ROOT_FOLDER_NAME (or 'Ek Duje Ke Liye') from Drive root,
 * and persists the ROOT_FOLDER_ID for future high-speed executions.
 */
function getArchiveRootFolder() {
  var props = PropertiesService.getScriptProperties();
  var rootFolderId = props.getProperty('ROOT_FOLDER_ID');
  
  if (rootFolderId) {
    try {
      var folder = DriveApp.getFolderById(rootFolderId);
      // Confirm accessibility
      folder.getName();
      return folder;
    } catch (err) {
      Logger.log('⚠️ Configured ROOT_FOLDER_ID (' + rootFolderId + ') could not be opened. Falling back to folder name search.');
    }
  }
  
  var rootFolderName = props.getProperty('ROOT_FOLDER_NAME') || CONFIG.DEFAULT_ROOT_FOLDER || 'Ek Duje Ke Liye';
  var driveRoot = DriveApp.getRootFolder();
  var existing = driveRoot.getFoldersByName(rootFolderName);
  var folder;
  
  if (existing.hasNext()) {
    folder = existing.next();
  } else {
    folder = driveRoot.createFolder(rootFolderName);
  }
  
  // Persist the real folder ID
  props.setProperty('ROOT_FOLDER_ID', folder.getId());
  return folder;
}

/**
 * Helper: Strictly gets or creates a child subfolder within a valid parentFolder.
 * Throws explicit error if parentFolder or folderName is invalid.
 */
function getOrCreateFolder(parentFolder, folderName) {
  if (!parentFolder) {
    throw new Error('getOrCreateFolder: parentFolder is undefined or null.');
  }
  
  if (!folderName || !String(folderName).trim()) {
    throw new Error('getOrCreateFolder: folderName is empty.');
  }
  
  var cleanName = String(folderName).trim();
  var folders = parentFolder.getFoldersByName(cleanName);
  
  if (folders.hasNext()) {
    return folders.next();
  }
  
  return parentFolder.createFolder(cleanName);
}

/**
 * Helper: Resolves/creates nested folder hierarchy under the Archive Root.
 * Strips the root folder name from the beginning of the path to prevent duplicate nesting.
 */
function getOrCreateFolderPath(folderPath) {
  var root = getArchiveRootFolder();
  if (!root) {
    throw new Error('Archive root folder could not be resolved.');
  }
  
  var rootName = root.getName();
  var parts = String(folderPath || '')
    .split('/')
    .map(function(part) { return part.trim(); })
    .filter(Boolean);
    
  // Backend paths may include root name (e.g. "Ek Duje Ke Liye/Events/...")
  if (parts.length > 0 && parts[0].toLowerCase() === rootName.toLowerCase()) {
    parts.shift();
  }
  
  var currentFolder = root;
  for (var i = 0; i < parts.length; i++) {
    currentFolder = getOrCreateFolder(currentFolder, parts[i]);
  }
  
  return currentFolder;
}

/**
 * ============================================================================
 * HEALTH & SETUP TEST
 * ============================================================================
 */

/**
 * Setup and Connectivity Test (Non-Mutating)
 * Run manually in Apps Script Editor to verify permissions and backend connection.
 * Tests authentication against /api/internal/archive/health without claiming or touching jobs.
 */
function setupAndTestConnection() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var backendUrl = props.BACKEND_URL;
  var workerSecret = props.ARCHIVE_WORKER_SECRET;
  
  if (!backendUrl || !workerSecret) {
    Logger.log('❌ MISSING CONFIGURATION: Please set BACKEND_URL and ARCHIVE_WORKER_SECRET in Script Properties.');
    return;
  }
  
  Logger.log('Testing connectivity to health endpoint: ' + backendUrl + '/api/internal/archive/health');
  
  try {
    var res = UrlFetchApp.fetch(backendUrl + '/api/internal/archive/health', {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + workerSecret,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    });
    
    var statusCode = res.getResponseCode();
    var responseBody = res.getContentText();
    
    Logger.log('Backend response code: ' + statusCode);
    Logger.log('Backend response payload: ' + responseBody);
    
    if (statusCode === 200) {
      Logger.log('✅ Backend archive worker authentication successful (200 OK).');
      
      // Initialize or verify Google Drive folder structure (Safe & Idempotent)
      var rootFolder = getArchiveRootFolder();
      var backupsFolder = getOrCreateFolder(rootFolder, 'Database Backups');
      getOrCreateFolder(backupsFolder, 'Daily');
      getOrCreateFolder(backupsFolder, 'Weekly');
      getOrCreateFolder(backupsFolder, 'Monthly');
      getOrCreateFolder(rootFolder, 'Events');
      getOrCreateFolder(rootFolder, 'System');
      
      Logger.log('✅ SUCCESS: Google Drive folder structure verified at: ' + rootFolder.getUrl());
      Logger.log('ℹ️ NOTE: Queue state was NOT modified (Health test is completely non-mutating).');
    } else if (statusCode === 401 || statusCode === 403) {
      Logger.log('❌ AUTHENTICATION ERROR (' + statusCode + '): Worker credentials invalid. Check ARCHIVE_WORKER_SECRET.');
    } else if (statusCode === 404) {
      Logger.log('❌ ROUTE NOT FOUND (404): Backend /api/internal/archive/health route is not deployed.');
    } else if (statusCode >= 500) {
      Logger.log('❌ BACKEND ERROR (' + statusCode + '): Server encountered an internal error.');
    } else {
      Logger.log('❌ UNEXPECTED RESPONSE (' + statusCode + '): ' + responseBody);
    }
  } catch (err) {
    Logger.log('❌ CONNECTION ERROR: ' + err.toString());
  }
}

/**
 * Helper: Physically verifies that a Google Drive file exists by its File ID
 * Run manually in Apps Script Editor to validate an archived file.
 */
function verifyDriveFileById(fileId) {
  var userEmail = Session.getEffectiveUser().getEmail() || 'Unknown';
  Logger.log('👤 [Apps Script Identity] Active Google Account: ' + userEmail);
  
  if (!fileId) {
    Logger.log('❌ MISSING FILE ID: Please pass a valid fileId.');
    return { exists: false, error: 'Missing fileId' };
  }
  
  try {
    var file = DriveApp.getFileById(fileId);
    if (!file || file.isTrashed()) {
      Logger.log('❌ NOT FOUND: File ' + fileId + ' is trashed or does not exist.');
      return { exists: false, error: 'File trashed or not found' };
    }
    
    var sizeBytes = file.getSize();
    var mimeType = file.getMimeType();
    var name = file.getName();
    var parents = file.getParents();
    var parentName = parents.hasNext() ? parents.next().getName() : 'Root';
    
    Logger.log('✅ PHYSICAL DRIVE VERIFICATION SUCCESS:');
    Logger.log('- File ID: ' + file.getId());
    Logger.log('- File Name: ' + name);
    Logger.log('- File Size: ' + sizeBytes + ' bytes (~' + (sizeBytes / 1024).toFixed(1) + ' KB)');
    Logger.log('- MIME Type: ' + mimeType);
    Logger.log('- Parent Folder: ' + parentName);
    Logger.log('- Direct View Link: https://drive.google.com/file/d/' + file.getId() + '/view');
    
    return {
      exists: true,
      fileId: file.getId(),
      name: name,
      size: sizeBytes,
      mimeType: mimeType,
      viewUrl: 'https://drive.google.com/file/d/' + file.getId() + '/view'
    };
  } catch (err) {
    Logger.log('❌ PHYSICAL DRIVE VERIFICATION FAILED: ' + err.toString());
    return { exists: false, error: err.toString() };
  }
}

/**
 * ============================================================================
 * ISOLATED SINGLE-PHOTO ARCHIVE TEST FUNCTION
 * ============================================================================
 * Executes an authentic binary transfer of exactly ONE targeted archive job from Cloudinary to Google Drive.
 * 
 * Usage:
 * 1. Set TARGET_TEST_JOB_ID in Script Properties (or pass jobId).
 * 2. Run runSingleArchiveTest() in Apps Script Editor.
 */
function runSingleArchiveTest(targetJobId) {
  var userEmail = Session.getEffectiveUser().getEmail() || 'Unknown';
  Logger.log('👤 [Apps Script Identity] Active Google Account: ' + userEmail);
  
  var props = PropertiesService.getScriptProperties().getProperties();
  var backendUrl = props.BACKEND_URL;
  var workerSecret = props.ARCHIVE_WORKER_SECRET;
  var jobId = targetJobId || props.TARGET_TEST_JOB_ID;
  
  if (!backendUrl || !workerSecret) {
    Logger.log('❌ MISSING CONFIGURATION: Please configure BACKEND_URL and ARCHIVE_WORKER_SECRET.');
    return;
  }
  
  if (!jobId) {
    Logger.log('❌ MISSING JOB ID: Please supply jobId as an argument or set TARGET_TEST_JOB_ID in Script Properties.');
    return;
  }
  
  Logger.log('🚀 [Single Test] Initiating authentic claim for Job ID: ' + jobId);
  
  // 1. Claim ONLY this single job
  var claimUrl = backendUrl + '/api/internal/archive/claim-one';
  var claimRes = UrlFetchApp.fetch(claimUrl, {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + workerSecret,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({ jobId: jobId, workerId: 'gas-single-test-worker' }),
    muteHttpExceptions: true
  });
  
  if (claimRes.getResponseCode() !== 200) {
    Logger.log('❌ [Single Test] Failed to claim job (HTTP ' + claimRes.getResponseCode() + '): ' + claimRes.getContentText());
    return;
  }
  
  var claimData = JSON.parse(claimRes.getContentText());
  var job = claimData.job;
  Logger.log('✅ [Single Test] Claimed job: ' + job.registrationId + ' (' + job.filename + ')');
  
  try {
    // 2. Fetch media directly from Cloudinary URL
    Logger.log('[Single Test] Downloading binary from Cloudinary: ' + job.sourceUrl);
    var mediaRes = UrlFetchApp.fetch(job.sourceUrl, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'EkDujeKeLiye-ArchiveWorker/2.0' }
    });
    
    if (mediaRes.getResponseCode() !== 200) {
      throw new Error('Cloudinary source returned HTTP ' + mediaRes.getResponseCode());
    }
    
    var blob = mediaRes.getBlob();
    blob.setName(job.filename);
    if (job.mimeType) blob.setContentType(job.mimeType);
    
    // 3. Resolve destination folder in Google Drive safely
    var targetFolder = getOrCreateFolderPath(job.folderPath);
    
    // 4. Save authentic file to Google Drive
    Logger.log('[Single Test] Saving file to Drive folder: ' + targetFolder.getName());
    var driveFile = targetFolder.createFile(blob);
    var realFileId = driveFile.getId();
    
    // 5. Physical Re-Open Verification immediately after upload
    Logger.log('[Single Test] Re-opening file from Google Drive by ID: ' + realFileId);
    var verifiedDriveFile = DriveApp.getFileById(realFileId);
    
    if (!verifiedDriveFile || verifiedDriveFile.isTrashed()) {
      throw new Error('Physical verification failed: File was not retrieved after creation.');
    }
    
    var fileSize = verifiedDriveFile.getSize();
    var mimeType = verifiedDriveFile.getMimeType();
    var realFolderId = targetFolder.getId();
    
    if (fileSize <= 0) {
      throw new Error('Physical verification failed: Created file size is 0 bytes.');
    }
    
    Logger.log('✅ [Single Test] Authentic Google Drive file verified physically:');
    Logger.log('- Real Drive File ID: ' + realFileId);
    Logger.log('- Real File Name: ' + verifiedDriveFile.getName());
    Logger.log('- Real File Size: ' + fileSize + ' bytes (~' + (fileSize / 1024).toFixed(1) + ' KB)');
    Logger.log('- Real MIME Type: ' + mimeType);
    Logger.log('- Real Folder ID: ' + realFolderId);
    Logger.log('- Direct File URL: https://drive.google.com/file/d/' + realFileId + '/view');
    Logger.log('- Folder URL: https://drive.google.com/drive/folders/' + realFolderId);
    
    // 6. Report authentic verification to backend
    var verifyUrl = backendUrl + '/api/internal/archive/verify-item';
    var verifyRes = UrlFetchApp.fetch(verifyUrl, {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + workerSecret,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        jobId: job.jobId,
        driveFileId: realFileId,
        driveFolderId: realFolderId,
        fileSize: fileSize,
        mimeType: mimeType
      }),
      muteHttpExceptions: true
    });
    
    if (verifyRes.getResponseCode() === 200) {
      Logger.log('🎉 [Single Test] SUCCESS! Backend marked job as authentically VERIFIED in MongoDB ledger.');
    } else {
      Logger.log('⚠️ [Single Test] Backend verify returned HTTP ' + verifyRes.getResponseCode() + ': ' + verifyRes.getContentText());
    }
  } catch (err) {
    Logger.log('❌ [Single Test] Error processing transfer: ' + err.toString());
    
    // Report failure to backend
    try {
      UrlFetchApp.fetch(backendUrl + '/api/internal/archive/fail-item', {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + workerSecret,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          jobId: job.jobId,
          error: err.toString()
        }),
        muteHttpExceptions: true
      });
    } catch (_) {}
  }
}

/**
 * ============================================================================
 * AUTOMATIC EVENT ARCHIVE WORKER (PRODUCTION WORKER)
 * ============================================================================
 * Discovers the active ARCHIVING event from MongoDB backend automatically.
 * No manual Program/Event ID required in Script Properties.
 * 
 * Flow:
 * 1. Calls POST /api/internal/archive/claim-active-event-batch
 * 2. If count === 0: logs "No active archive work." and exits cleanly (idle).
 * 3. If jobs exist:
 *    - Downloads each image from Cloudinary.
 *    - Saves to Google Drive folder: Ek Duje Ke Liye/Events/<slug>/Couple Photos/
 *    - Reopens by Drive ID with DriveApp.getFileById() to verify existence, size > 0, MIME.
 *    - Calls POST /api/internal/archive/verify-item.
 *    - If single file fails, calls fail-item and continues safely without breaking batch.
 * 4. Can be installed as a permanent 10-minute trigger in Google Apps Script.
 */
function runAutomaticArchiveWorker() {
  var startTime = new Date().getTime();
  var props = PropertiesService.getScriptProperties().getProperties();
  
  var backendUrl = props.BACKEND_URL;
  var workerSecret = props.ARCHIVE_WORKER_SECRET;
  
  if (!backendUrl || !workerSecret) {
    Logger.log('❌ ERROR: BACKEND_URL and ARCHIVE_WORKER_SECRET must be configured.');
    return;
  }
  
  var userEmail = Session.getEffectiveUser().getEmail() || 'Unknown';
  Logger.log('👤 [Apps Script Identity] Active Google Account: ' + userEmail);
  Logger.log('🤖 [Automatic Archive Worker] Checking backend for active ARCHIVING event...');
  
  // 1. Claim active event batch (12 items max)
  var claimUrl = backendUrl + '/api/internal/archive/claim-active-event-batch';
  var claimRes;
  try {
    claimRes = UrlFetchApp.fetch(claimUrl, {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + workerSecret,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        workerId: 'gas-auto-worker-' + userEmail.replace(/[^a-zA-Z0-9]/g, '_'),
        limit: 12
      }),
      muteHttpExceptions: true
    });
  } catch (netErr) {
    Logger.log('❌ [Automatic Worker] Network error connecting to backend: ' + netErr.toString());
    return;
  }
  
  if (claimRes.getResponseCode() !== 200) {
    Logger.log('❌ [Automatic Worker] Backend returned HTTP ' + claimRes.getResponseCode() + ': ' + claimRes.getContentText());
    return;
  }
  
  var batchData = JSON.parse(claimRes.getContentText());
  var activeEvent = batchData.activeEvent;
  var jobs = batchData.jobs || [];
  
  if (!activeEvent || jobs.length === 0) {
    Logger.log('ℹ️ [Automatic Worker] No active archive work (Queue idle or no event in ARCHIVING status). Exiting.');
    return;
  }
  
  Logger.log('📦 [Automatic Worker] Active Event: ' + activeEvent.name + ' (' + activeEvent.id + ')');
  Logger.log('🚀 [Automatic Worker] Claimed ' + jobs.length + ' job(s). Starting Cloudinary -> Google Drive transfer...');
  
  var processed = 0;
  var succeeded = 0;
  var failed = 0;
  
  for (var i = 0; i < jobs.length; i++) {
    if (new Date().getTime() - startTime > CONFIG.MAX_EXECUTION_TIME_MS) {
      Logger.log('⏳ [Automatic Worker] Reached execution time budget. Pausing. Next recurring trigger will continue automatically.');
      break;
    }
    
    var job = jobs[i];
    Logger.log('\n--- [' + (i + 1) + '/' + jobs.length + '] Processing: ' + job.registrationId + ' (' + job.filename + ') ---');
    
    try {
      var targetFolder = getOrCreateFolderPath(job.folderPath);
      
      // Check for existing file by name to avoid duplicate copies
      var existingFiles = targetFolder.getFilesByName(job.filename);
      var driveFile = null;
      
      if (existingFiles.hasNext()) {
        driveFile = existingFiles.next();
        Logger.log('ℹ️ Existing file found in folder by name. Reusing: ' + driveFile.getId());
      } else {
        var mediaRes = UrlFetchApp.fetch(job.sourceUrl, { muteHttpExceptions: true });
        if (mediaRes.getResponseCode() !== 200) {
          throw new Error('Cloudinary fetch returned HTTP ' + mediaRes.getResponseCode());
        }
        
        var blob = mediaRes.getBlob();
        blob.setName(job.filename);
        driveFile = targetFolder.createFile(blob);
      }
      
      var driveFileId = driveFile.getId();
      
      // Physical Re-Open Verification
      var verifiedFile = DriveApp.getFileById(driveFileId);
      if (!verifiedFile || verifiedFile.isTrashed()) {
        throw new Error('Physical verification failed: File not found in Drive by ID');
      }
      
      var fileSize = verifiedFile.getSize();
      var mimeType = verifiedFile.getMimeType();
      
      if (fileSize <= 0) {
        throw new Error('Physical verification failed: Drive file size is 0 bytes');
      }
      if (!mimeType || mimeType.indexOf('image/') !== 0) {
        throw new Error('Physical verification failed: Invalid MIME type ' + mimeType);
      }
      
      Logger.log('✅ Physical verification passed: ' + driveFileId + ' (' + fileSize + ' bytes)');
      
      // Notify backend
      var verifyUrl = backendUrl + '/api/internal/archive/verify-item';
      var verifyRes = UrlFetchApp.fetch(verifyUrl, {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + workerSecret,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          jobId: job.jobId,
          driveFileId: driveFileId,
          driveFolderId: targetFolder.getId(),
          fileSize: fileSize,
          mimeType: mimeType
        }),
        muteHttpExceptions: true
      });
      
      if (verifyRes.getResponseCode() === 200) {
        succeeded++;
      } else {
        Logger.log('⚠️ Backend verify returned HTTP ' + verifyRes.getResponseCode() + ': ' + verifyRes.getContentText());
      }
    } catch (itemErr) {
      failed++;
      Logger.log('❌ Item failed: ' + itemErr.toString());
      try {
        UrlFetchApp.fetch(backendUrl + '/api/internal/archive/fail-item', {
          method: 'post',
          headers: {
            'Authorization': 'Bearer ' + workerSecret,
            'Content-Type': 'application/json'
          },
          payload: JSON.stringify({ jobId: job.jobId, error: itemErr.toString() }),
          muteHttpExceptions: true
        });
      } catch (_) {}
    }
    
    processed++;
    Utilities.sleep(300);
  }
  
  Logger.log('\n====================================================');
  Logger.log('🎉 [Automatic Worker Batch Finished]');
  Logger.log('- Event: ' + activeEvent.name);
  Logger.log('- Processed: ' + processed + ' | Succeeded: ' + succeeded + ' | Failed: ' + failed);
  Logger.log('====================================================');
}

/**
 * ============================================================================
 * EVENT-SCOPED ARCHIVE WORKER (Controlled Event Archiving)
 * ============================================================================
 * Claims and archives ONLY jobs for a specific eventId (e.g. prog-1785566789678).
 * Never touches or contaminates jobs belonging to other events.
 * 
 * Usage:
 * 1. Set TARGET_ARCHIVE_EVENT_ID in Script Properties (or pass eventId).
 * 2. Run runEventArchiveWorker() in Apps Script Editor.
 */
function runEventArchiveWorker(targetEventId) {
  var startTime = new Date().getTime();
  var props = PropertiesService.getScriptProperties().getProperties();
  
  var backendUrl = props.BACKEND_URL;
  var workerSecret = props.ARCHIVE_WORKER_SECRET;
  var eventId = targetEventId || props.TARGET_ARCHIVE_EVENT_ID;
  
  if (!backendUrl || !workerSecret) {
    Logger.log('❌ ERROR: BACKEND_URL and ARCHIVE_WORKER_SECRET must be configured.');
    return;
  }
  
  if (!eventId) {
    Logger.log('❌ ERROR: TARGET_ARCHIVE_EVENT_ID must be set in Script Properties or passed to runEventArchiveWorker(eventId).');
    return;
  }
  
  var userEmail = Session.getEffectiveUser().getEmail() || 'Unknown';
  Logger.log('👤 [Apps Script Identity] Active Google Account: ' + userEmail);
  Logger.log('🚀 [Event Worker] Starting event-scoped archive batch for Event ID: ' + eventId);
  
  // 1. Claim batch scoped strictly to eventId (12 files max per run)
  var claimUrl = backendUrl + '/api/internal/archive/claim-event-batch';
  var claimRes;
  try {
    claimRes = UrlFetchApp.fetch(claimUrl, {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + workerSecret,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        eventId: eventId,
        workerId: 'gas-event-worker-' + userEmail.replace(/[^a-zA-Z0-9]/g, '_'),
        limit: 12
      }),
      muteHttpExceptions: true
    });
  } catch (netErr) {
    Logger.log('❌ [Event Worker] Network error connecting to backend: ' + netErr.toString());
    return;
  }
  
  if (claimRes.getResponseCode() !== 200) {
    Logger.log('❌ [Event Worker] Failed to claim event batch (HTTP ' + claimRes.getResponseCode() + '): ' + claimRes.getContentText());
    return;
  }
  
  var batchData = JSON.parse(claimRes.getContentText());
  var jobs = batchData.jobs || [];
  
  if (jobs.length === 0) {
    Logger.log('🎉 [Event Worker] No queued jobs remaining for Event: ' + eventId + '. Event archive complete!');
    return;
  }
  
  Logger.log('📦 [Event Worker] Claimed ' + jobs.length + ' event-scoped job(s). Starting Cloudinary -> Google Drive transfer...');
  
  var processed = 0;
  var succeeded = 0;
  var failed = 0;
  
  for (var i = 0; i < jobs.length; i++) {
    if (new Date().getTime() - startTime > CONFIG.MAX_EXECUTION_TIME_MS) {
      Logger.log('⏳ [Event Worker] Reached safety execution time budget. Pausing. Run runEventArchiveWorker again to continue.');
      break;
    }
    
    var job = jobs[i];
    Logger.log('\n--- [' + (i + 1) + '/' + jobs.length + '] Processing: ' + job.registrationId + ' (' + job.filename + ') ---');
    
    try {
      var targetFolder = getOrCreateFolderPath(job.folderPath);
      
      // Check for existing file to avoid duplicate copies
      var existingFiles = targetFolder.getFilesByName(job.filename);
      var driveFile = null;
      
      if (existingFiles.hasNext()) {
        driveFile = existingFiles.next();
        Logger.log('ℹ️ Existing file found in folder by name. Reusing: ' + driveFile.getId());
      } else {
        var mediaRes = UrlFetchApp.fetch(job.sourceUrl, { muteHttpExceptions: true });
        if (mediaRes.getResponseCode() !== 200) {
          throw new Error('Cloudinary fetch returned HTTP ' + mediaRes.getResponseCode());
        }
        
        var blob = mediaRes.getBlob();
        blob.setName(job.filename);
        driveFile = targetFolder.createFile(blob);
      }
      
      var driveFileId = driveFile.getId();
      
      // Physical Re-Open Verification
      var verifiedFile = DriveApp.getFileById(driveFileId);
      if (!verifiedFile || verifiedFile.isTrashed()) {
        throw new Error('Physical verification failed: File not found in Drive by ID');
      }
      
      var fileSize = verifiedFile.getSize();
      var mimeType = verifiedFile.getMimeType();
      
      if (fileSize <= 0) {
        throw new Error('Physical verification failed: Drive file size is 0 bytes');
      }
      if (!mimeType || mimeType.indexOf('image/') !== 0) {
        throw new Error('Physical verification failed: Invalid MIME type ' + mimeType);
      }
      
      Logger.log('✅ Physical verification passed: ' + driveFileId + ' (' + fileSize + ' bytes)');
      
      // Notify backend
      var verifyUrl = backendUrl + '/api/internal/archive/verify-item';
      var verifyRes = UrlFetchApp.fetch(verifyUrl, {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + workerSecret,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          jobId: job.jobId,
          driveFileId: driveFileId,
          driveFolderId: targetFolder.getId(),
          fileSize: fileSize,
          mimeType: mimeType
        }),
        muteHttpExceptions: true
      });
      
      if (verifyRes.getResponseCode() === 200) {
        succeeded++;
      } else {
        Logger.log('⚠️ Backend verify returned HTTP ' + verifyRes.getResponseCode() + ': ' + verifyRes.getContentText());
      }
    } catch (itemErr) {
      failed++;
      Logger.log('❌ Item failed: ' + itemErr.toString());
      try {
        UrlFetchApp.fetch(backendUrl + '/api/internal/archive/fail-item', {
          method: 'post',
          headers: {
            'Authorization': 'Bearer ' + workerSecret,
            'Content-Type': 'application/json'
          },
          payload: JSON.stringify({ jobId: job.jobId, error: itemErr.toString() }),
          muteHttpExceptions: true
        });
      } catch (_) {}
    }
    
    processed++;
    Utilities.sleep(300);
  }
  
  Logger.log('\n====================================================');
  Logger.log('🎉 [Event Worker Batch Finished]');
  Logger.log('- Processed: ' + processed + ' | Succeeded: ' + succeeded + ' | Failed: ' + failed);
  Logger.log('====================================================');
}

/**
 * ============================================================================
 * GENERAL BATCH ARCHIVE WORKER (DISABLED UNTIL MASS ARCHIVE PHASE)
 * ============================================================================
 */
function runMediaArchiveWorker() {
  var startTime = new Date().getTime();
  var props = PropertiesService.getScriptProperties().getProperties();
  
  var backendUrl = props.BACKEND_URL;
  var workerSecret = props.ARCHIVE_WORKER_SECRET;
  
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
  
  var processed = 0;
  var succeeded = 0;
  var failed = 0;
  
  // 2. Process each job sequentially
  for (var i = 0; i < jobs.length; i++) {
    if (new Date().getTime() - startTime > CONFIG.MAX_EXECUTION_TIME_MS) {
      Logger.log('[Archive Worker] Reached safety execution time budget. Pausing until next scheduled trigger.');
      break;
    }
    
    var job = jobs[i];
    Logger.log('[Archive Worker] Processing item ' + (i + 1) + '/' + jobs.length + ': ' + job.filename);
    
    try {
      var targetFolder = getOrCreateFolderPath(job.folderPath);
      
      var mediaRes = UrlFetchApp.fetch(job.sourceUrl, { muteHttpExceptions: true });
      if (mediaRes.getResponseCode() !== 200) {
        throw new Error('Cloudinary fetch returned HTTP ' + mediaRes.getResponseCode());
      }
      
      var blob = mediaRes.getBlob();
      blob.setName(job.filename);
      
      var driveFile = targetFolder.createFile(blob);
      var driveFileId = driveFile.getId();
      var fileSize = driveFile.getSize();
      var mimeType = driveFile.getMimeType();
      
      Logger.log('[Archive Worker] Successfully saved to Drive. File ID: ' + driveFileId + ' (' + fileSize + ' bytes)');
      
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
    Utilities.sleep(400);
  }
  
  Logger.log('[Archive Worker] Batch finished. Processed: ' + processed + ' | Succeeded: ' + succeeded + ' | Failed: ' + failed);
}

/**
 * ============================================================================
 * SINGLE DATABASE BACKUP SYNC TO GOOGLE DRIVE
 * ============================================================================
 * Streams exactly ONE database backup snapshot (.json.gz) and its manifest (.json)
 * directly from Render into authorized Google Drive folders.
 * 
 * Usage:
 * 1. Set TARGET_BACKUP_ID in Script Properties (or pass backupId).
 * 2. Run runSingleBackupSync() in Apps Script Editor.
 */
function runSingleBackupSync(targetBackupId) {
  var userEmail = Session.getEffectiveUser().getEmail() || 'Unknown';
  Logger.log('👤 [Apps Script Identity] Active Google Account: ' + userEmail);
  
  var props = PropertiesService.getScriptProperties().getProperties();
  var backendUrl = props.BACKEND_URL;
  var backupSecret = props.BACKUP_WORKER_SECRET;
  var backupId = targetBackupId || props.TARGET_BACKUP_ID;
  
  if (!backendUrl || !backupSecret) {
    Logger.log('❌ MISSING CONFIGURATION: BACKEND_URL and BACKUP_WORKER_SECRET must be configured.');
    return;
  }
  
  if (!backupId) {
    Logger.log('❌ MISSING BACKUP ID: Please pass backupId as argument or set TARGET_BACKUP_ID in Script Properties.');
    return;
  }
  
  Logger.log('🚀 [Backup Sync] Starting authentic Google Drive sync for Backup ID: ' + backupId);
  
  try {
    // 1. Fetch Backup Manifest from backend
    var manifestUrl = backendUrl + '/api/internal/backups/' + encodeURIComponent(backupId) + '/manifest';
    Logger.log('[Backup Sync] Fetching manifest from: ' + manifestUrl);
    
    var manifestRes = UrlFetchApp.fetch(manifestUrl, {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + backupSecret,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    });
    
    if (manifestRes.getResponseCode() !== 200) {
      Logger.log('❌ [Backup Sync] Failed to fetch manifest (HTTP ' + manifestRes.getResponseCode() + '): ' + manifestRes.getContentText());
      return;
    }
    
    var manifestData = JSON.parse(manifestRes.getContentText());
    var backupType = manifestData.type || 'manual';
    var checksum = manifestData.checksum || 'N/A';
    Logger.log('✅ [Backup Sync] Manifest loaded. Type: ' + backupType + ' | Checksum: ' + checksum);
    
    // 2. Download gzip database snapshot binary
    var fileUrl = backendUrl + '/api/internal/backups/' + encodeURIComponent(backupId) + '/file';
    Logger.log('[Backup Sync] Downloading database snapshot binary (.json.gz)...');
    
    var fileRes = UrlFetchApp.fetch(fileUrl, {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + backupSecret,
        'User-Agent': 'EkDujeKeLiye-BackupWorker/2.0'
      },
      muteHttpExceptions: true
    });
    
    if (fileRes.getResponseCode() !== 200) {
      Logger.log('❌ [Backup Sync] Failed to download backup snapshot (HTTP ' + fileRes.getResponseCode() + '): ' + fileRes.getContentText());
      return;
    }
    
    var gzipBlob = fileRes.getBlob();
    var gzFilename = backupId + '.json.gz';
    gzipBlob.setName(gzFilename);
    gzipBlob.setContentType('application/gzip');
    
    // 3. Resolve destination Google Drive folder (e.g. Database Backups/Manual)
    var rootFolder = getArchiveRootFolder();
    var backupsFolder = getOrCreateFolder(rootFolder, 'Database Backups');
    var subfolderName = backupType.charAt(0).toUpperCase() + backupType.slice(1);
    var targetFolder = getOrCreateFolder(backupsFolder, subfolderName);
    
    // 4. Save authentic .json.gz file into Google Drive
    Logger.log('[Backup Sync] Saving .json.gz file to Drive folder: Database Backups/' + subfolderName);
    var driveGzipFile = targetFolder.createFile(gzipBlob);
    var gzipFileId = driveGzipFile.getId();
    
    // 5. Save manifest .json file into Google Drive
    var manifestFilename = 'manifest_' + backupId + '.json';
    var manifestJsonStr = JSON.stringify(manifestData.manifest || manifestData, null, 2);
    var manifestBlob = Utilities.newBlob(manifestJsonStr, 'application/json', manifestFilename);
    Logger.log('[Backup Sync] Saving manifest JSON to Drive folder: Database Backups/' + subfolderName);
    var driveManifestFile = targetFolder.createFile(manifestBlob);
    var manifestFileId = driveManifestFile.getId();
    
    // 6. Physical Re-Open Verification immediately after upload
    Logger.log('[Backup Sync] Re-opening files from Google Drive by ID to verify physical existence...');
    var verifiedGzip = DriveApp.getFileById(gzipFileId);
    var verifiedManifest = DriveApp.getFileById(manifestFileId);
    
    if (!verifiedGzip || verifiedGzip.isTrashed()) {
      throw new Error('Physical verification failed: Gzip backup file not retrieved from Drive.');
    }
    if (!verifiedManifest || verifiedManifest.isTrashed()) {
      throw new Error('Physical verification failed: Manifest JSON file not retrieved from Drive.');
    }
    
    var gzipSize = verifiedGzip.getSize();
    var manifestSize = verifiedManifest.getSize();
    
    if (gzipSize <= 0) throw new Error('Physical verification failed: Gzip backup file size is 0 bytes.');
    if (manifestSize <= 0) throw new Error('Physical verification failed: Manifest file size is 0 bytes.');
    
    Logger.log('✅ [Backup Sync] Authentic Google Drive files verified physically:');
    Logger.log('- Real Gzip File ID: ' + gzipFileId);
    Logger.log('- Real Gzip File Name: ' + verifiedGzip.getName());
    Logger.log('- Real Gzip File Size: ' + gzipSize + ' bytes (~' + (gzipSize / 1024).toFixed(1) + ' KB)');
    Logger.log('- Real Manifest File ID: ' + manifestFileId);
    Logger.log('- Real Manifest File Name: ' + verifiedManifest.getName());
    Logger.log('- Real Manifest Size: ' + manifestSize + ' bytes');
    Logger.log('- Real Folder ID: ' + targetFolder.getId());
    Logger.log('- Direct Gzip File URL: https://drive.google.com/file/d/' + gzipFileId + '/view');
    Logger.log('- Direct Manifest File URL: https://drive.google.com/file/d/' + manifestFileId + '/view');
    Logger.log('- Folder URL: https://drive.google.com/drive/folders/' + targetFolder.getId());
    
    // 7. Report verification to backend
    var verifyUrl = backendUrl + '/api/internal/backups/verify-sync';
    var verifyRes = UrlFetchApp.fetch(verifyUrl, {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + backupSecret,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        backupId: backupId,
        driveFileId: gzipFileId,
        driveManifestFileId: manifestFileId,
        driveFolderId: targetFolder.getId(),
        fileSize: gzipSize
      }),
      muteHttpExceptions: true
    });
    
    if (verifyRes.getResponseCode() === 200) {
      Logger.log('🎉 [Backup Sync] SUCCESS! Backend marked BackupRecord as verified and pruned local temp file.');
    } else {
      Logger.log('⚠️ [Backup Sync] Backend verify returned HTTP ' + verifyRes.getResponseCode() + ': ' + verifyRes.getContentText());
    }
  } catch (err) {
    Logger.log('❌ [Backup Sync] Error processing backup transfer: ' + err.toString());
  }
}

/**
 * ============================================================================
 * DAILY BACKUP SYNC
 * ============================================================================
 */
function runDailyBackupSync() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var backendUrl = props.BACKEND_URL;
  var workerSecret = props.BACKUP_WORKER_SECRET;
  
  if (!backendUrl || !workerSecret) {
    Logger.log('ERROR: BACKEND_URL and BACKUP_WORKER_SECRET not configured.');
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
 * ============================================================================
 * SECURE ARCHIVED PHOTO VIEWER (Web App GET Handler)
 * ============================================================================
 * Handles HMAC-SHA256 signed iframe viewer requests for Google Drive archived media.
 */
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action;
  
  if (action !== 'viewArchivedPhoto') {
    return createErrorHtml('400 Bad Request', 'Invalid action requested.');
  }
  
  var registrationId = params.registrationId;
  var fileId = params.fileId;
  var exp = parseInt(params.exp, 10);
  var nonce = params.nonce;
  var sig = params.sig;
  
  if (!registrationId || !fileId || !exp || !nonce || !sig) {
    return createErrorHtml('400 Bad Request', 'Missing required security parameters.');
  }
  
  // 1. Check Expiration
  var nowSeconds = Math.floor(new Date().getTime() / 1000);
  if (nowSeconds > exp) {
    return createErrorHtml('403 Forbidden', 'Access token has expired. Please refresh the admin viewer.');
  }
  
  // 2. Verify HMAC-SHA256 Signature
  var props = PropertiesService.getScriptProperties().getProperties();
  var viewSecret = props.GOOGLE_MEDIA_VIEW_SECRET;
  
  if (!viewSecret) {
    return createErrorHtml('500 Server Error', 'GOOGLE_MEDIA_VIEW_SECRET is not configured in Script Properties.');
  }
  
  var message = registrationId + ':' + fileId + ':' + exp + ':' + nonce;
  var signatureBytes = Utilities.computeHmacSha256Signature(message, viewSecret);
  var expectedSig = signatureBytes.map(function(byte) {
    var v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
  
  if (expectedSig !== sig) {
    return createErrorHtml('403 Forbidden', 'Invalid cryptographic signature or tampered request.');
  }
  
  // 3. Fetch Drive file safely
  try {
    var driveFile = DriveApp.getFileById(fileId);
    if (!driveFile || driveFile.isTrashed()) {
      return createErrorHtml('404 Not Found', 'Archived original photo not found in Google Drive.');
    }
    
    var mimeType = driveFile.getMimeType();
    if (!mimeType || mimeType.indexOf('image/') !== 0) {
      return createErrorHtml('400 Invalid Media', 'Requested asset is not an image file.');
    }
    
    var blob = driveFile.getBlob();
    var base64Data = Utilities.base64Encode(blob.getBytes());
    var dataUri = 'data:' + mimeType + ';base64,' + base64Data;
    var filename = driveFile.getName();
    var fileSize = (blob.getBytes().length / 1024).toFixed(1) + ' KB';
    
    var htmlContent = '<!DOCTYPE html>' +
      '<html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>' + filename + ' — Archived Original</title>' +
      '<style>' +
      '* { box-sizing: border-box; margin: 0; padding: 0; }' +
      'body { background: #0b0f17; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }' +
      '.container { max-width: 900px; width: 100%; display: flex; flex-direction: column; align-items: center; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(51, 65, 85, 0.6); border-radius: 12px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(10px); }' +
      '.header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid #1e293b; font-size: 13px; color: #94a3b8; }' +
      '.badge { background: #0284c7; color: #fff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; }' +
      '.img-wrapper { max-height: 75vh; width: 100%; display: flex; justify-content: center; align-items: center; overflow: hidden; border-radius: 8px; background: #020617; }' +
      'img { max-width: 100%; max-height: 75vh; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }' +
      '.footer { width: 100%; text-align: center; margin-top: 12px; font-size: 11px; color: #64748b; }' +
      '</style></head><body>' +
      '<div class="container">' +
      '<div class="header">' +
      '<div><strong>' + registrationId + '</strong> &bull; ' + filename + '</div>' +
      '<span class="badge">Google Drive Private Archive</span>' +
      '</div>' +
      '<div class="img-wrapper">' +
      '<img src="' + dataUri + '" alt="Archived Couple Photo" />' +
      '</div>' +
      '<div class="footer">Encrypted Transfer &bull; Size: ' + fileSize + ' &bull; Expiring Session</div>' +
      '</div>' +
      '</body></html>';
      
    var output = HtmlService.createHtmlOutput(htmlContent);
    output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return output;
  } catch (driveErr) {
    return createErrorHtml('500 Error', 'Unable to retrieve file from Google Drive: ' + driveErr.toString());
  }
}

function createErrorHtml(title, message) {
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>body{background:#0b0f17;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;}' +
    '.card{background:#1e1e2d;border:1px solid #3f3f46;border-radius:10px;padding:24px;max-width:400px;box-shadow:0 8px 24px rgba(0,0,0,0.4);}' +
    'h2{margin-bottom:8px;font-size:18px;color:#ef4444;}p{font-size:13px;color:#94a3b8;}</style></head><body>' +
    '<div class="card"><h2>' + title + '</h2><p>' + message + '</p></div></body></html>';
  var output = HtmlService.createHtmlOutput(html);
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
}
