import { env } from '../config/env.js';

/**
 * Authentication Middleware with RBAC & Legacy Password Support
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized. No authorization header provided.' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // Validate Admin or Super Admin credentials
  if (token === env.ADMIN_PASSWORD || token === env.SUPER_ADMIN_PASSWORD) {
    req.user = {
      role: token === env.SUPER_ADMIN_PASSWORD ? 'SUPER_ADMIN' : 'EVENT_ADMIN',
      authenticated: true
    };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid authentication credentials.' });
};

/**
 * Attaches req.user if authorization header is valid, but allows unauthenticated to pass through
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token === env.ADMIN_PASSWORD || token === env.SUPER_ADMIN_PASSWORD) {
    req.user = {
      role: token === env.SUPER_ADMIN_PASSWORD ? 'SUPER_ADMIN' : 'EVENT_ADMIN',
      authenticated: true
    };
  }
  return next();
};

export const requireSuperAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized. No authorization header provided.' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (token === env.SUPER_ADMIN_PASSWORD) {
    req.user = {
      role: 'SUPER_ADMIN',
      authenticated: true
    };
    return next();
  }

  if (token === env.ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Forbidden: Super Administrator privileges required.' });
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid authentication credentials.' });
};

export const requireArchiveWorkerAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: Missing worker authorization header.' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (token && ((env.ARCHIVE_WORKER_SECRET && token === env.ARCHIVE_WORKER_SECRET) || token === env.SUPER_ADMIN_PASSWORD)) {
    req.worker = { type: 'ARCHIVE_WORKER', authenticated: true };
    return next();
  }

  return res.status(403).json({ error: 'Forbidden: Invalid archive worker credentials.' });
};

export const requireBackupWorkerAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: Missing backup worker authorization header.' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // Strictly dedicated to BACKUP_WORKER_SECRET (or Super Admin manual trigger)
  if (token && ((env.BACKUP_WORKER_SECRET && token === env.BACKUP_WORKER_SECRET) || token === env.SUPER_ADMIN_PASSWORD)) {
    req.worker = { type: 'BACKUP_WORKER', authenticated: true };
    return next();
  }

  return res.status(403).json({ error: 'Forbidden: Invalid backup worker credentials.' });
};

export const requireCronAuth = (req, res, next) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (!env.CRON_SECRET) {
    return res.status(503).json({ error: 'Cron secret is not configured.' });
  }
  if (secret === env.CRON_SECRET) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden: Invalid cron secret.' });
};
