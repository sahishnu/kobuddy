import { book, bookDevice } from '@kobuddy/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '../lib/db.js';

/** Minimum `max(total_read_pages)` per book to list on the home shelf when not finished. */
export const SHELF_MIN_READ_PAGES = 5;

export type BookDeviceAggRow = {
  bookMd5: string;
  maxRead: number;
  maxPages: number;
  maxLastOpen: number;
};

/** Per-book rollups from `book_device` (visible books only). */
export async function loadBookDeviceAggregates(
  db: DbClient,
): Promise<BookDeviceAggRow[]> {
  const rows = await db
    .select({
      bookMd5: bookDevice.bookMd5,
      maxRead: sql<number>`max(${bookDevice.totalReadPages})`.mapWith(Number),
      maxPages: sql<number>`max(${bookDevice.pages})`.mapWith(Number),
      maxLastOpen:
        sql<number>`max(coalesce(${bookDevice.lastOpen}, 0))`.mapWith(Number),
    })
    .from(bookDevice)
    .innerJoin(book, eq(book.md5, bookDevice.bookMd5))
    .where(eq(book.hidden, false))
    .groupBy(bookDevice.bookMd5);
  return rows;
}

/**
 * Same rule as dashboard "currently reading": unfinished books
 * (`read < pages`) with highest recent `lastOpen`.
 */
export function pickCurrentReadingBookMd5(
  rows: BookDeviceAggRow[],
): string | null {
  const unfinished = rows.filter(
    (x) => (x.maxPages ?? 0) > 0 && (x.maxRead ?? 0) < (x.maxPages ?? 0),
  );
  if (unfinished.length === 0) return null;
  unfinished.sort((a, b) => (b.maxLastOpen ?? 0) - (a.maxLastOpen ?? 0));
  return unfinished[0]?.bookMd5 ?? null;
}
