import { book, bookDevice } from '@kobuddy/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '../lib/db.js';
import { SHELF_MIN_READ_PAGES } from './constants.js';

/** Per-Book rollup across BookDevice rows (visible books only in `load`). */
export type BookDeviceAggRow = {
  bookMd5: string;
  maxRead: number;
  maxPages: number;
  maxLastOpen: number;
  completedAt: number | null;
};

export const maxReadAgg =
  sql<number>`max(${bookDevice.totalReadPages})`.mapWith(Number);
export const maxPagesAgg = sql<number>`max(${bookDevice.pages})`.mapWith(
  Number,
);
export const maxLastOpenAgg =
  sql<number>`max(coalesce(${bookDevice.lastOpen}, 0))`.mapWith(Number);

export function shelfEligibleHaving() {
  return sql`(${maxReadAgg} >= ${SHELF_MIN_READ_PAGES} OR (${maxPagesAgg} > 0 AND ${maxReadAgg} >= ${maxPagesAgg}))`;
}

export function mapLastOpenForWire(maxLastOpen: number): number | null {
  return maxLastOpen > 0 ? maxLastOpen : null;
}

export function isUnfinishedForCurrentReading(row: BookDeviceAggRow): boolean {
  return (
    row.completedAt == null &&
    (row.maxPages ?? 0) > 0 &&
    (row.maxRead ?? 0) < (row.maxPages ?? 0)
  );
}

export function isShelfEligible(
  row: Pick<BookDeviceAggRow, 'maxRead' | 'maxPages'>,
): boolean {
  const maxRead = row.maxRead ?? 0;
  const maxPages = row.maxPages ?? 0;
  return (
    maxRead >= SHELF_MIN_READ_PAGES || (maxPages > 0 && maxRead >= maxPages)
  );
}

export function pickCurrentlyReadingMd5(
  rows: BookDeviceAggRow[],
): string | null {
  const unfinished = rows.filter(isUnfinishedForCurrentReading);
  if (unfinished.length === 0) return null;
  unfinished.sort((a, b) => (b.maxLastOpen ?? 0) - (a.maxLastOpen ?? 0));
  return unfinished[0]?.bookMd5 ?? null;
}

export async function loadVisibleBookDeviceAggregates(
  db: DbClient,
): Promise<BookDeviceAggRow[]> {
  return db
    .select({
      bookMd5: bookDevice.bookMd5,
      maxRead: maxReadAgg,
      maxPages: maxPagesAgg,
      maxLastOpen: maxLastOpenAgg,
      completedAt: book.completedAt,
    })
    .from(bookDevice)
    .innerJoin(book, eq(book.md5, bookDevice.bookMd5))
    .where(eq(book.hidden, false))
    .groupBy(bookDevice.bookMd5);
}

export function sumMaxReadPagesAcrossBooks(
  rows: Pick<BookDeviceAggRow, 'maxRead'>[],
): number {
  return rows.reduce((acc, row) => acc + (row.maxRead ?? 0), 0);
}

export async function totalPagesReadVisible(db: DbClient): Promise<number> {
  const rows = await loadVisibleBookDeviceAggregates(db);
  return sumMaxReadPagesAcrossBooks(rows);
}
