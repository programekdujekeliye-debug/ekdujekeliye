/**
 * Ek Duje Ke Liye — V2 Platform Entry Point Adapter
 * 
 * Provides 100% backward-compatible startup for Render, local PM2, and npm start (node index.js).
 */
import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

import startServer from './src/server.js';
export { app } from './src/app.js';

// Launch the modular V2 server
startServer();
