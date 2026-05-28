import type { LoadingQuote, LoadingQuoteInput } from '@kobuddy/common';
import { loadingQuote } from '@kobuddy/db/schema';
import { asc, desc, eq, sql } from 'drizzle-orm';
import type { DbClient } from '../lib/db.js';

/** Map a DB row to the API shape in `@kobuddy/common`. */
function toLoadingQuote(row: typeof loadingQuote.$inferSelect): LoadingQuote {
  return {
    id: row.id,
    text: row.text,
    author: row.author,
    book: row.book,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

export async function listLoadingQuotes(db: DbClient): Promise<LoadingQuote[]> {
  const rows = await db
    .select()
    .from(loadingQuote)
    .orderBy(asc(loadingQuote.sortOrder), asc(loadingQuote.id));
  return rows.map(toLoadingQuote);
}

export async function getRandomLoadingQuote(
  db: DbClient,
): Promise<LoadingQuote | null> {
  const [row] = await db
    .select()
    .from(loadingQuote)
    .where(eq(loadingQuote.enabled, true))
    .orderBy(sql`RANDOM()`)
    .limit(1);
  return row ? toLoadingQuote(row) : null;
}

export async function createLoadingQuote(
  db: DbClient,
  input: LoadingQuoteInput,
): Promise<LoadingQuote> {
  const [maxRow] = await db
    .select({ sortOrder: loadingQuote.sortOrder })
    .from(loadingQuote)
    .orderBy(desc(loadingQuote.sortOrder))
    .limit(1);
  const nextSort =
    input.sortOrder ?? (maxRow?.sortOrder != null ? maxRow.sortOrder + 1 : 0);

  const [row] = await db
    .insert(loadingQuote)
    .values({
      text: input.text,
      author: input.author,
      book: input.book,
      enabled: input.enabled ?? true,
      sortOrder: nextSort,
    })
    .returning();
  if (!row) throw new Error('Failed to create loading quote');
  return toLoadingQuote(row);
}

export async function updateLoadingQuote(
  db: DbClient,
  id: number,
  input: LoadingQuoteInput,
): Promise<LoadingQuote | null> {
  const [row] = await db
    .update(loadingQuote)
    .set({
      text: input.text,
      author: input.author,
      book: input.book,
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    })
    .where(eq(loadingQuote.id, id))
    .returning();
  return row ? toLoadingQuote(row) : null;
}

export async function deleteLoadingQuote(
  db: DbClient,
  id: number,
): Promise<boolean> {
  const result = await db
    .delete(loadingQuote)
    .where(eq(loadingQuote.id, id))
    .returning({ id: loadingQuote.id });
  return result.length > 0;
}
