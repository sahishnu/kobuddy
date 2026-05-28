/**
 * Load splash quotes from `default-quotes.ts` into the database.
 *
 *   pnpm seed:loading-quotes              # only if table is empty
 *   pnpm seed:loading-quotes -- --replace # delete all rows, then insert defaults
 */

import { config } from '../config.js';
import { createDatabase } from '../lib/db.js';
import { resolveSqlitePath } from '../lib/paths.js';
import { syncDefaultLoadingQuotes } from '../loading-quotes/sync-default-loading-quotes.js';

function parseArgs(argv: string[]): { replace: boolean } {
  return { replace: argv.includes('--replace') };
}

async function main() {
  const { replace } = parseArgs(process.argv.slice(2));
  const cfg = config;
  const sqlitePath = resolveSqlitePath(cfg.DATA_PATH, cfg.DATABASE_FILE);
  const { db, raw } = createDatabase(cfg, sqlitePath);

  const result = await syncDefaultLoadingQuotes(
    db,
    replace ? 'replace' : 'if-empty',
  );

  if (result.skipped) {
    console.log('loading_quote already has rows; nothing to seed.');
    console.log('Edit apps/server/src/loading-quotes/default-quotes.ts, then:');
    console.log('  pnpm seed:loading-quotes -- --replace');
  } else {
    console.log(
      `Loaded ${result.inserted} splash quotes into ${sqlitePath} (${result.mode})`,
    );
  }

  raw.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
