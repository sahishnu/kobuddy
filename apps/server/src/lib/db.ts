import * as schema from '@kobuddy/db/schema';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AppConfig } from '../config.js';
import { defaultMigrationsPath } from './paths.js';

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

export function migrationsFolder(cfg: AppConfig): string {
  return cfg.MIGRATIONS_PATH ?? defaultMigrationsPath();
}

export type SqliteHandle = {
  close: () => void;
};

export function createDatabase(
  cfg: AppConfig,
  sqlitePath: string,
): {
  db: DbClient;
  raw: SqliteHandle;
} {
  const raw = new Database(sqlitePath);
  raw.pragma('journal_mode = WAL');
  const db = drizzle(raw, { schema });
  migrate(db, { migrationsFolder: migrationsFolder(cfg) });
  return { db, raw: raw as SqliteHandle };
}
