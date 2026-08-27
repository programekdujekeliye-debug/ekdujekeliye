import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { initializeBackupCron } from './jobs/backup.job.js';

const startServer = async () => {
  try {
    // 1. Connect to MongoDB Atlas
    await connectDatabase();

    // 2. Initialize scheduled cron tasks
    initializeBackupCron();

    // 3. Start HTTP server
    const server = app.listen(env.PORT, () => {
      console.log(`[Ek Duje Ke Liye] V2 Platform Server running on port ${env.PORT} (${env.NODE_ENV})`);
    });

    // Graceful shutdown handlers
    const shutdown = () => {
      console.log('\n[Server] Graceful shutdown initiated...');
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
