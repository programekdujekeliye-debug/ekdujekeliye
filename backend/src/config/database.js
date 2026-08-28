import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Single, Reusable Mongoose Connection Pool
 * Configured specifically for resource-constrained Render Free environments (< 300MB RAM target).
 */
export const connectDatabase = async () => {
  try {
    mongoose.set('autoIndex', false);
    mongoose.set('autoCreate', false);

    const options = {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4
    };

    await mongoose.connect(env.MONGO_URI, options);
    console.log('[Database] Successfully connected to MongoDB Atlas (Connection Pool active).');
  } catch (err) {
    console.error('[Database] Failed to connect to MongoDB Atlas:', err);
    throw err;
  }
};
