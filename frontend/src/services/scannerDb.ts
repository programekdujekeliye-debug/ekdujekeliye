/**
 * IndexedDB persistence layer for EDKL Mobile Gate Scanner
 * Survives browser close, refresh, and phone restarts
 */

const DB_NAME = 'edkl_gate_scanner_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export interface OfflineScan {
  scanLocalId: string;
  qrToken: string;
  passId: string;
  eventId: string;
  deviceId: string;
  deviceSequence: number;
  scannedAtDevice: string;
  syncStatus: 'PENDING' | 'SYNCED' | 'CONFLICT';
  result?: string;
  coupleName?: string;
  inquiryId?: string;
}

export interface PreparedEventData {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  publicKey: {
    keyId: string;
    algorithm: string;
    publicKeySpkiBase64: string;
  };
  revokedPassIds: string[];
  cachedAt: string;
}

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Offline Scans store
      if (!db.objectStoreNames.contains('offline_scans')) {
        const scanStore = db.createObjectStore('offline_scans', { keyPath: 'scanLocalId' });
        scanStore.createIndex('eventId', 'eventId', { unique: false });
        scanStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        scanStore.createIndex('passId', 'passId', { unique: false });
      }

      // 2. Event preparation & offline cache
      if (!db.objectStoreNames.contains('event_prep')) {
        db.createObjectStore('event_prep', { keyPath: 'eventId' });
      }

      // 3. Persistent device metadata
      if (!db.objectStoreNames.contains('device_info')) {
        db.createObjectStore('device_info', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

/**
 * Get or create persistent non-invasive device ID (e.g. EDKL-DEVICE-XXXX)
 */
export async function getOrCreateDeviceId(): Promise<string> {
  if (typeof window === 'undefined') return 'EDKL-DEVICE-SSR';

  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction('device_info', 'readwrite');
      const store = tx.objectStore('device_info');
      const getReq = store.get('deviceId');

      getReq.onsuccess = () => {
        if (getReq.result && getReq.result.value) {
          resolve(getReq.result.value);
        } else {
          // Generate new persistent random device identifier
          const randomId = `EDKL-DEVICE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
          store.put({ key: 'deviceId', value: randomId });
          resolve(randomId);
        }
      };

      getReq.onerror = () => {
        resolve(`EDKL-DEVICE-FALLBACK-${Math.random().toString(36).substring(2, 8)}`);
      };
    });
  } catch (e) {
    const local = localStorage.getItem('edkl_device_id');
    if (local) return local;
    const generated = `EDKL-DEVICE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    try { localStorage.setItem('edkl_device_id', generated); } catch (_) {}
    return generated;
  }
}

/**
 * Save prepared event data into IndexedDB for offline scanning
 */
export async function savePreparedEvent(data: PreparedEventData): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('event_prep', 'readwrite');
    const store = tx.objectStore('event_prep');
    const req = store.put(data);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get cached prepared event
 */
export async function getPreparedEvent(eventId: string): Promise<PreparedEventData | null> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction('event_prep', 'readonly');
      const store = tx.objectStore('event_prep');
      const req = store.get(eventId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Check if a pass has already been scanned on THIS local device
 */
export async function isPassScannedOnThisDevice(eventId: string, passId: string): Promise<OfflineScan | null> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction('offline_scans', 'readonly');
      const store = tx.objectStore('offline_scans');
      const index = store.index('passId');
      const req = index.getAll(passId);

      req.onsuccess = () => {
        const matches: OfflineScan[] = req.result || [];
        const matchingEvent = matches.find(s => s.eventId === eventId);
        resolve(matchingEvent || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Save an offline scan record into IndexedDB
 */
export async function saveOfflineScan(scan: OfflineScan): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('offline_scans', 'readwrite');
    const store = tx.objectStore('offline_scans');
    const req = store.put(scan);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all pending offline scans for an event
 */
export async function getPendingOfflineScans(eventId: string): Promise<OfflineScan[]> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction('offline_scans', 'readonly');
      const store = tx.objectStore('offline_scans');
      const req = store.getAll();

      req.onsuccess = () => {
        const all: OfflineScan[] = req.result || [];
        const pending = all.filter(s => s.eventId === eventId && s.syncStatus === 'PENDING');
        resolve(pending);
      };
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

/**
 * Mark offline scans as synced
 */
export async function markScansSynced(syncedResults: Array<{ scanLocalId: string; result: string }>): Promise<void> {
  const db = await getDb();
  return new Promise((resolve) => {
    const tx = db.transaction('offline_scans', 'readwrite');
    const store = tx.objectStore('offline_scans');

    syncedResults.forEach(({ scanLocalId, result }) => {
      const getReq = store.get(scanLocalId);
      getReq.onsuccess = () => {
        if (getReq.result) {
          const updated = {
            ...getReq.result,
            syncStatus: result === 'CONFLICT' ? 'CONFLICT' : 'SYNCED',
            result
          };
          store.put(updated);
        }
      };
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/**
 * Count total scans and sync stats for an event
 */
export async function getLocalScanStats(eventId: string): Promise<{ pending: number; synced: number; conflicts: number }> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction('offline_scans', 'readonly');
      const store = tx.objectStore('offline_scans');
      const req = store.getAll();

      req.onsuccess = () => {
        const all: OfflineScan[] = (req.result || []).filter((s: OfflineScan) => s.eventId === eventId);
        const pending = all.filter(s => s.syncStatus === 'PENDING').length;
        const synced = all.filter(s => s.syncStatus === 'SYNCED').length;
        const conflicts = all.filter(s => s.syncStatus === 'CONFLICT').length;
        resolve({ pending, synced, conflicts });
      };
      req.onerror = () => resolve({ pending: 0, synced: 0, conflicts: 0 });
    });
  } catch (e) {
    return { pending: 0, synced: 0, conflicts: 0 };
  }
}
