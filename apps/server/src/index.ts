import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { config } from './config.js';
import { createApp } from './create-app.js';
import { createDatabase } from './lib/db.js';
import { resolveSqlitePath } from './lib/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sqlitePath = resolveSqlitePath(config.DATA_PATH, config.DATABASE_FILE);
const { db, raw } = createDatabase(config, sqlitePath);

const webDist = path.resolve(__dirname, '../../web/dist');
const app = createApp(config, db, webDist);

serve(
  { fetch: app.fetch, port: config.PORT, hostname: config.HOSTNAME },
  (info) => {
    console.info(`kobuddy listening on http://${info.address}:${info.port}`);
  },
);

const shutdown = () => {
  raw.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
