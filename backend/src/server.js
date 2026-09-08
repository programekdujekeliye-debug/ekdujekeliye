import dns from 'dns';
// Enforce IPv4-first resolution to prevent Windows NAT64 IPv6 socket timeouts on MongoDB Atlas
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { initializeBackupCron } from './jobs/backup.job.js';
import { ensureEarlyRegistrationEvents } from './services/eventInit.service.js';
import { communicationSchedulerService } from './services/communicationScheduler.service.js';
import { runPaymentReminders } from './jobs/paymentReminders.job.js';
import sharp from 'sharp';

// Strictly constrain Sharp memory & concurrency for 512MB container environments
try {
  sharp.cache({ memory: 20, files: 0, items: 50 });
  sharp.concurrency(1);
  sharp.simd(true);
} catch (e) {
  console.warn('[Sharp Config] Notice:', e.message);
}

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]:', reason);
});

let workerInterval = null;

const startServer = async () => {
  try {
    // 1. Connect to MongoDB Atlas
    await connectDatabase();

    // 2. Ensure Early Registration Events in Database
    await ensureEarlyRegistrationEvents();

    // 3. Initialize scheduled cron tasks
    initializeBackupCron();

    // 4. Initialize in-process WhatsApp Communication Worker (Every 60s)
    workerInterval = setInterval(async () => {
      try {
        await communicationSchedulerService.processScheduledJobs({ batchSize: 25 });
        await runPaymentReminders();
      } catch (err) {
        console.warn('[WhatsApp Worker Cron] Error processing jobs:', err.message);
      }
    }, 60 * 1000);

    // 5. Start HTTP server
    const server = app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`[Ek Duje Ke Liye] V2 Platform Server running on port ${env.PORT} (${env.NODE_ENV})`);

      // 6. Production Keep-Alive Ping (Runs only if running on Render rollback instance to keep container warm)
      if (process.env.RENDER) {
        setInterval(async () => {
          try {
            const healthUrl = process.env.RENDER_EXTERNAL_URL || 'https://ekdujekeliye-s9fx.onrender.com/api/health';
            await fetch(healthUrl);
            console.log('[Render Keepalive] Successfully pinged health endpoint to maintain warm container.');
          } catch (pingErr) {
            console.warn('[Render Keepalive] Ping warning:', pingErr.message);
          }
        }, 9 * 60 * 1000);
      }

      // 7. Memory Telemetry (Logs every 5 mins to track 512MB container health in production)
      if (env.NODE_ENV === 'production') {
        setInterval(() => {
          const mem = process.memoryUsage();
          const rssMb = Math.round(mem.rss / 1024 / 1024);
          const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
          const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
          console.log(`[Memory Monitor] RSS: ${rssMb}MB, Heap: ${heapUsedMb}MB / ${heapTotalMb}MB`);
        }, 5 * 60 * 1000);
      }
    });

    server.on('error', (err) => {
      console.error('[Server Error]:', err.message);
      process.exit(1);
    });

    // Graceful shutdown handlers
    const shutdown = () => {
      console.log('\n[Server] Graceful shutdown initiated...');
      if (workerInterval) clearInterval(workerInterval);
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    return server;
  } catch (err) {
    console.error('Failed to initialize server:', err);
    process.exit(1);
  }
};

export default startServer;

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}
