/**
 * Load splash quotes from `default-quotes.ts` into the database.
 *
 *   pnpm seed:loading-quotes              # only if table is empty
 *   pnpm seed:loading-quotes -- --replace # delete all rows, then insert defaults
 */

import { loadingQuote } from '@kobuddy/db/schema';
import { count } from 'drizzle-orm';
import { config } from '../config.js';
import { createDatabase } from '../lib/db.js';
import { resolveSqlitePath } from '../lib/paths.js';
import { DEFAULT_LOADING_QUOTES } from '../loading-quotes/default-quotes.js';

function parseArgs(argv: string[]): { replace: boolean } {
  return { replace: argv.includes('--replace') };
}

async function main() {
  const { replace } = parseArgs(process.argv.slice(2));
  const cfg = config;
  const sqlitePath = resolveSqlitePath(cfg.DATA_PATH, cfg.DATABASE_FILE);
  const { db, raw } = createDatabase(cfg, sqlitePath);

  const [row] = await db.select({ n: count() }).from(loadingQuote);
  const existing = row?.n ?? 0;

  if (existing > 0 && !replace) {
    console.log(
      `loading_quote already has ${existing} row(s); nothing to seed.`,
    );
    console.log('Edit apps/server/src/loading-quotes/default-quotes.ts, then:');
    console.log('  pnpm seed:loading-quotes -- --replace');
    raw.close();
    return;
  }

  if (replace && existing > 0) {
    await db.delete(loadingQuote);
    console.log(`Removed ${existing} existing quote(s).`);
  }

  await db.insert(loadingQuote).values(
    DEFAULT_LOADING_QUOTES.map((q, i) => ({
      text: q.text,
      author: q.author,
      book: q.book,
      enabled: true,
      sortOrder: i,
    })),
  );

  console.log(
    `Loaded ${DEFAULT_LOADING_QUOTES.length} splash quotes into ${sqlitePath}`,
  );
  raw.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
