/**
 * One-time helper: copy READING_GOAL_BOOKS from the environment into `reading_goal`
 * for the current UTC calendar year. Run after applying migration 0004.
 *
 *   READING_GOAL_BOOKS=12 pnpm exec tsx apps/server/scripts/migrate-reading-goal-from-env.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readingGoal } from '@kobuddy/db/schema';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

async function main() {
  const raw = process.env.READING_GOAL_BOOKS?.trim();
  const books = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(books) || books < 1) {
    console.error('Set READING_GOAL_BOOKS to a positive integer.');
    process.exit(1);
  }

  const dbPath =
    process.env.DATABASE_URL?.replace(/^file:/, '') ??
    path.join(process.cwd(), 'data', 'kobuddy.db');

  const here = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.resolve(
    here,
    '../../../packages/db/migrations',
  );

  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });

  const year = new Date().getUTCFullYear();
  await db.insert(readingGoal).values({ year, books }).onConflictDoUpdate({
    target: readingGoal.year,
    set: { books },
  });

  console.log(`Set reading goal for ${year} to ${books} books in ${dbPath}`);
  sqlite.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
