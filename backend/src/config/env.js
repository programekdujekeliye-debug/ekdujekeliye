import fs from 'fs';
import path from 'path';

// Load environment variables from .env if running locally
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
} catch (e) { }

const APP_ENV = (process.env.APP_ENV || 'development').toLowerCase();
const PRODUCTION_DATABASE_NAME = 'ekdujekeliye';

/**
 * Extract database name from MongoDB connection string safely
 */
export function extractDatabaseName(uri) {
  if (!uri) return '';
  try {
    const questionIdx = uri.indexOf('?');
    const cleanUri = questionIdx !== -1 ? uri.substring(0, questionIdx) : uri;
    const lastSlashIdx = cleanUri.lastIndexOf('/');
    if (lastSlashIdx !== -1) {
      return cleanUri.substring(lastSlashIdx + 1).trim();
    }
  } catch (e) { }
  return '';
}

const resolvedMongoUri = (process.env.MONGO_URI || '').trim();
if (!resolvedMongoUri) {
  throw new Error('[CONFIGURATION ERROR] MONGO_URI is required. Configure it in the environment; no database URI fallback is allowed.');
}

const databaseName = extractDatabaseName(resolvedMongoUri);

/**
 * CRITICAL DATABASE & ENVIRONMENT STARTUP GUARDS
 */
if (APP_ENV !== 'production') {
  if (databaseName === PRODUCTION_DATABASE_NAME) {
    throw new Error(
      `[CRITICAL SAFETY BLOCK] Non-production server (APP_ENV=${APP_ENV}) cannot connect to production database '${PRODUCTION_DATABASE_NAME}'. Please configure MONGO_URI to use 'ekdujekeliye_test'.`
    );
  }
} else {
  if (databaseName.includes('test') || databaseName.includes('staging') || databaseName.includes('dev')) {
    throw new Error(
      `[CRITICAL SAFETY BLOCK] Production server (APP_ENV=production) cannot connect to test/staging database '${databaseName}'.`
    );
  }
}

// Razorpay Mode & Prefix Safety Guard
const RAZORPAY_MODE = (process.env.RAZORPAY_MODE || (APP_ENV === 'production' ? 'live' : 'test')).toLowerCase();
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';

if (razorpayKeyId) {
  if (RAZORPAY_MODE === 'test' && !razorpayKeyId.startsWith('rzp_test_')) {
    throw new Error(
      `[CRITICAL SAFETY BLOCK] RAZORPAY_MODE is 'test' but RAZORPAY_KEY_ID does not start with 'rzp_test_'. Refusing startup.`
    );
  }
  if (RAZORPAY_MODE === 'live' && !razorpayKeyId.startsWith('rzp_live_')) {
    throw new Error(
      `[CRITICAL SAFETY BLOCK] RAZORPAY_MODE is 'live' but RAZORPAY_KEY_ID does not start with 'rzp_live_'. Refusing startup.`
    );
  }
}

/**
 * Safely mask sensitive secrets for logging (e.g. EAAX**************ZD)
 */
export function maskSecret(secret, visibleStart = 4, visibleEnd = 2) {
  if (!secret) return '(not configured)';
  if (secret.length <= visibleStart + visibleEnd) return '********';
  const start = secret.substring(0, visibleStart);
  const end = secret.substring(secret.length - visibleEnd);
  return `${start}${'*'.repeat(Math.max(6, secret.length - visibleStart - visibleEnd))}${end}`;
}

/**
 * Normalize phone number to international digits-only format (e.g., 918320594829)
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let clean = String(phone).replace(/\D/g, '');
  if (clean.length === 10) {
    clean = '91' + clean;
  }
  return clean;
}

export const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v26.0';

/**
 * Central Meta Graph API URL constructor
 */
export function getMetaGraphApiUrl(path = '') {
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${cleanPath}`;
}

function readOptionalEnv(name) {
  return process.env[name] || '';
}

function requireEnvWhen(condition, name, reason) {
  const value = readOptionalEnv(name);
  if (condition && !value) {
    throw new Error(`[CONFIGURATION ERROR] ${name} is required when ${reason}. Configure it in the environment; no secret fallback is allowed.`);
  }
  return value;
}

const ADMIN_PASSWORD = requireEnvWhen(true, 'ADMIN_PASSWORD', 'admin authentication is enabled');
const SUPER_ADMIN_PASSWORD = requireEnvWhen(true, 'SUPER_ADMIN_PASSWORD', 'super-admin authentication is enabled');
const WHATSAPP_SEND_ENABLED = process.env.WHATSAPP_SEND_ENABLED !== 'false';
const WHATSAPP_ACCESS_TOKEN = requireEnvWhen(WHATSAPP_SEND_ENABLED, 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_SEND_ENABLED is true');
const WHATSAPP_PHONE_NUMBER_ID = requireEnvWhen(WHATSAPP_SEND_ENABLED, 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_SEND_ENABLED is true');
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = requireEnvWhen(true, 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'Meta webhook verification is enabled');
const RAZORPAY_KEY_SECRET = requireEnvWhen(Boolean(razorpayKeyId), 'RAZORPAY_KEY_SECRET', 'RAZORPAY_KEY_ID is configured');

export const env = {
  APP_ENV,
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5001,
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL || (APP_ENV === 'production' ? 'https://www.ekdujekeliye.in' : 'http://localhost:3000'),

  // Database
  MONGO_URI: resolvedMongoUri,
  DATABASE_NAME: databaseName,
  DATABASE_ENV: databaseName.includes('test') ? 'TEST' : (databaseName.includes('staging') ? 'STAGING' : 'PRODUCTION'),

  // Passwords
  ADMIN_PASSWORD,
  SUPER_ADMIN_PASSWORD,

  // Cloudinary
  CLOUDINARY_ENV: process.env.CLOUDINARY_ENV || (APP_ENV === 'production' ? 'production' : 'test'),
  CLOUDINARY_FOLDER_PREFIX: (process.env.CLOUDINARY_ENV || (APP_ENV === 'production' ? 'production' : 'test')) === 'test' ? 'edkl-test/' : '',
  CLOUDINARY_CLOUD_NAME: readOptionalEnv('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: readOptionalEnv('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: readOptionalEnv('CLOUDINARY_API_SECRET'),
  CLOUDINARY_CLEANUP_ENABLED: false,

  // Google Drive
  DRIVE_ENV: process.env.DRIVE_ENV || (APP_ENV === 'production' ? 'production' : 'test'),
  DRIVE_ROOT_FOLDER_NAME: (process.env.DRIVE_ENV || (APP_ENV === 'production' ? 'production' : 'test')) === 'test' ? 'Ek Duje Ke Liye TEST' : 'Ek Duje Ke Liye',

  // Razorpay
  RAZORPAY_MODE,
  RAZORPAY_KEY_ID: razorpayKeyId,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: readOptionalEnv('RAZORPAY_WEBHOOK_SECRET'),

  // Meta WhatsApp Cloud API
  META_GRAPH_API_VERSION,
  WHATSAPP_MODE: (process.env.WHATSAPP_MODE || (APP_ENV === 'production' ? 'production' : 'test')).toLowerCase(),
  WHATSAPP_SEND_ENABLED,
  WHATSAPP_TEST_RECIPIENTS: (process.env.WHATSAPP_TEST_RECIPIENTS || '918320594829,918200302328,919825100000,919724552042')
    .split(',')
    .map(s => normalizePhoneNumber(s.trim()))
    .filter(Boolean),
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_WABA_ID: readOptionalEnv('WHATSAPP_WABA_ID'),
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  WHATSAPP_BATCH_SIZE: Number(process.env.WHATSAPP_BATCH_SIZE) || 25,
  WHATSAPP_BATCH_DELAY_MS: Number(process.env.WHATSAPP_BATCH_DELAY_MS) || 200,

  // Worker Security Secrets
  CRON_SECRET: readOptionalEnv('CRON_SECRET'),
  ARCHIVE_WORKER_SECRET: readOptionalEnv('ARCHIVE_WORKER_SECRET'),
  BACKUP_WORKER_SECRET: readOptionalEnv('BACKUP_WORKER_SECRET'),
  GOOGLE_MEDIA_VIEW_SECRET: readOptionalEnv('GOOGLE_MEDIA_VIEW_SECRET'),
  APPS_SCRIPT_VIEWER_URL: readOptionalEnv('APPS_SCRIPT_VIEWER_URL'),
  ALLOW_MOCK_ARCHIVE_VERIFICATION: false,
  ENABLE_BACKEND_BACKUP_CRON: false,

  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : ['*']
};

console.log('====================================================');
console.log(`[Startup] APP_ENV: ${env.APP_ENV}`);
console.log(`[Startup] DATABASE ENVIRONMENT: ${env.DATABASE_ENV} (${env.DATABASE_NAME})`);
console.log(`[Startup] RAZORPAY MODE: ${env.RAZORPAY_MODE.toUpperCase()}`);
console.log(`[Startup] WHATSAPP MODE: ${env.WHATSAPP_MODE.toUpperCase()} (API: ${env.META_GRAPH_API_VERSION})`);
console.log(`[Startup] WHATSAPP TOKEN: ${env.WHATSAPP_ACCESS_TOKEN ? 'CONFIGURED' : 'MISSING'}`);
console.log(`[Startup] WHATSAPP PHONE ID: ${env.WHATSAPP_PHONE_NUMBER_ID ? 'CONFIGURED' : 'MISSING'}`);
console.log(`[Startup] CLOUDINARY ENV: ${env.CLOUDINARY_ENV.toUpperCase()} (Prefix: "${env.CLOUDINARY_FOLDER_PREFIX}")`);
console.log(`[Startup] DRIVE ENV: ${env.DRIVE_ENV.toUpperCase()} (Root: "${env.DRIVE_ROOT_FOLDER_NAME}")`);
console.log('====================================================');
