import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { config } from '../config/env.js';

/**
 * Development convenience: boots a real PostgreSQL (embedded binaries) so the
 * project runs without Docker or a system install. Production uses DATABASE_URL.
 */
export async function startEmbeddedPostgres({
  dir = path.join(config.root, '.pgdata'),
  port = config.embeddedPort,
  fresh = false,
  database = 'workora',
} = {}) {
  if (fresh) fs.rmSync(dir, { recursive: true, force: true });
  const firstRun = !fs.existsSync(path.join(dir, 'PG_VERSION'));
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'workora',
    password: 'workora',
    port,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: (e) => { if (process.env.PG_DEBUG) console.error('[pg]', e); },
  });
  if (firstRun) await pg.initialise();
  await pg.start();
  if (firstRun) await pg.createDatabase(database);
  const stop = async () => { try { await pg.stop(); } catch { /* already stopped */ } };
  return { pg, stop, url: `postgres://workora:workora@127.0.0.1:${port}/${database}`, firstRun };
}
