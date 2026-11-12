/**
 * Entry point for PRAVAH Full-Stack Automotive Telemetry Application
 * Runs Express backend APIs with Vite frontend middleware mounted in dev.
 */
import { startServer } from './backend/server';

startServer().catch((err) => {
  console.error('[PRAVAH] Fatal server startup error:', err);
  process.exit(1);
});
