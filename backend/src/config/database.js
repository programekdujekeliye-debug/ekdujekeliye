import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Single, Reusable Mongoose Connection Pool
 * Configured specifically for resource-constrained Render Free environments (< 300MB RAM target).
 */
export const connectDatabase = async () => {
  try {
    mongoose.set('autoIndex', false); // Disable automatic index builds in foreground to avoid startup buffering

    const options = {
      maxPoolSize: 10,                 // Conservative pool limit for small node instances
      minPoolSize: 1,                  // Keep 1 persistent socket open to avoid cold connection latency
      serverSelectionTimeoutMS: 5000,  // Fail fast if Atlas is unreachable
      socketTimeoutMS: 45000,          // Close inactive sockets to free memory
      family: 4                        // Force IPv4 to prevent dual-stack DNS delays
    };

    await mongoose.connect(env.MONGO_URI, options);
    console.log('[Database] Successfully connected to MongoDB Atlas (Connection Pool active).');

    // Asynchronously synchronize model indexes in background without blocking startup
    setImmediate(async () => {
      try {
        if (mongoose.modelNames().includes('Registration')) await mongoose.model('Registration').ensureIndexes();
        if (mongoose.modelNames().includes('Event')) await mongoose.model('Event').ensureIndexes();
        if (mongoose.modelNames().includes('WebhookEvent')) await mongoose.model('WebhookEvent').ensureIndexes();
        console.log('[Database] Domain indexes synchronized successfully.');
      } catch (err) {
        console.warn('[Database] Background index synchronization notice:', err.message);
      }
    });
  } catch (err) {
    console.error('[Database] Failed to connect to MongoDB Atlas:', err);
    throw err;
  }
};
