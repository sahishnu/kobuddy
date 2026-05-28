import { loadingQuote } from '@kobuddy/db/schema';
import { count } from 'drizzle-orm';
import type { DbClient } from '../lib/db.js';
import { DEFAULT_LOADING_QUOTES } from './default-quotes.js';

export type SyncLoadingQuotesMode = 'if-empty' | 'replace';

export type SyncLoadingQuotesResult = {
  mode: SyncLoadingQuotesMode;
  inserted: number;
  /** True when `if-empty` found existing rows and did nothing. */
  skipped: boolean;
};

/** Load `DEFAULT_LOADING_QUOTES` into the database (CLI, deploy hook, or admin API). */
export async function syncDefaultLoadingQuotes(
  db: DbClient,
  mode: SyncLoadingQuotesMode,
): Promise<SyncLoadingQuotesResult> {
  const [row] = await db.select({ n: count() }).from(loadingQuote);
  const existing = row?.n ?? 0;

  if (existing > 0 && mode === 'if-empty') {
    return { mode, inserted: 0, skipped: true };
  }

  if (mode === 'replace' && existing > 0) {
    await db.delete(loadingQuote);
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

  return {
    mode,
    inserted: DEFAULT_LOADING_QUOTES.length,
    skipped: false,
  };
}
