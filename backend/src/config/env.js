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
} catch (e) {}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5001,
  MONGO_URI: (process.env.MONGO_URI || 'mongodb+srv://programekdujekeliye_db_user:xSBKESML3bxquG7e@cluster0.dsixmq0.mongodb.net/ekdujekeliye?retryWrites=true&w=majority').trim(),
  
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Manas@1177',
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || 'Manish@1177',
  
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'rh3wmfta',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '733288215373621',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || 'dPBA6hRfCtO2gx-jZ6r1Bo98Hiw',
  
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  WHATSAPP_WABA_ID: process.env.WHATSAPP_WABA_ID || '',
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
  
  CRON_SECRET: process.env.CRON_SECRET || '',
  ARCHIVE_WORKER_SECRET: process.env.ARCHIVE_WORKER_SECRET || '023176b693554f4439e2f67716e0760a8ff953c2aee2165dbd485237ab6297fe',
  BACKUP_WORKER_SECRET: process.env.BACKUP_WORKER_SECRET || '3b2e91c9feebed5421dd9d086d841cc6876ae935cf694e7224abced4f283ed18',
  GOOGLE_MEDIA_VIEW_SECRET: process.env.GOOGLE_MEDIA_VIEW_SECRET || '9fb1ae65a72e7c03977af4cd252ce915652dc100df1732292d161b6adba47510',
  APPS_SCRIPT_VIEWER_URL: process.env.APPS_SCRIPT_VIEWER_URL || '',
  ALLOW_MOCK_ARCHIVE_VERIFICATION: process.env.ALLOW_MOCK_ARCHIVE_VERIFICATION === 'true',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : ['*']
};
