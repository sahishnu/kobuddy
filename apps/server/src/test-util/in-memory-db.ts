import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '@kobuddy/db/schema';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { DbClient } from '../lib/db.js';

function migrationsFolder(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../../packages/db/migrations');
}

export function createInMemoryDb(): DbClient {
  const raw = new Database(':memory:');
  raw.pragma('journal_mode = WAL');
  const db = drizzle(raw, { schema });
  migrate(db, { migrationsFolder: migrationsFolder() });
  return db;
}
