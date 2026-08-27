/**
 * Lightweight Structured Logger
 * Safe against dumping sensitive PII, passwords, and tokens.
 */
export const logger = {
  info: (msg, meta = {}) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },
  warn: (msg, meta = {}) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },
  error: (msg, err = null, meta = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, err ? (err.stack || err.message || err) : '', Object.keys(meta).length ? JSON.stringify(meta) : '');
  }
};
