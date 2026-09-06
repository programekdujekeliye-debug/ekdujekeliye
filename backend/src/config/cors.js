import cors from 'cors';
import { env } from './env.js';

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // If no origin (e.g. mobile app, curl, server-to-server) or allowed origins contains '*', allow
    if (!origin || env.ALLOWED_ORIGINS.includes('*') || env.ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    // Dynamic matching for development/preview URLs
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('vercel.app') || origin.includes('ekdujekeliye.in')) {
      return callback(null, true);
    }
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Razorpay-Signature',
    'X-Razorpay-Event-Id',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'x-admin-password',
    'x-super-admin-password',
    'x-cron-secret',
    'If-None-Match',
    'If-Match',
    'Range'
  ],
  exposedHeaders: ['ETag', 'Content-Length', 'Cache-Control'],
  credentials: true,
  maxAge: 86400 // Cache CORS preflight approval for 24 hours
});
