import http from 'node:http';
import { config } from './config/env.js';
import { createApp } from './app.js';
import { startEmbeddedPostgres } from './db/embedded.js';
import { migrate } from './db/migrate.js';
import { seed } from './db/seed.js';
import { startLifecycleJob } from './jobs/lifecycle.js';

let pgStop = null;

async function bootstrap() {
  console.log(`[workora] starting in ${config.env} mode...`);

  // 1. Database boot
  if (config.useEmbeddedDb) {
    console.log(`[workora] starting embedded PostgreSQL on port ${config.embeddedPort}...`);
    const pg = await startEmbeddedPostgres();
    pgStop = pg.stop;
    console.log('[workora] embedded PostgreSQL ready');
  }

  // 2. Migration & Schema Check
  console.log('[workora] migrating database schema and constraints...');
  await migrate();
  console.log('[workora] database schema synchronized');

  // 3. Seed demo data
  await seed();

  // 4. Start HTTP Server
  const app = createApp();
  const server = http.createServer(app);

  server.listen(config.port, () => {
    console.log(`🚀 WORKORA Server listening at http://localhost:${config.port}`);
    console.log(`✨ API routes mounted at http://localhost:${config.port}/api`);
    console.log(`🔒 Storage media at http://localhost:${config.port}/media`);
  });

  // 5. Background jobs
  const stopJobs = startLifecycleJob();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[workora] shutting down...');
    if (stopJobs) stopJobs();
    server.close();
    if (pgStop) await pgStop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[workora fatal error]:', err);
  if (pgStop) pgStop();
  process.exit(1);
});
