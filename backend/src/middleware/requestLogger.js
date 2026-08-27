import { logger } from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(2, 9);
  req.requestId = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.originalUrl.startsWith('/uploads') && !req.originalUrl.startsWith('/api/health')) {
      logger.info(`HTTP ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, {
        requestId,
        method: req.method,
        status: res.statusCode,
        duration
      });
    }
  });

  next();
};
