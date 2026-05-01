import type { CurrentReadingBook } from '@kobuddy/common';
import { book, bookDevice } from '@kobuddy/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '../lib/db.js';
import { displayTitle } from '../lib/display.js';

/** Core fields for the current-reading card; add `coverUrl` at the stats HTTP layer. */
export type CurrentReadingBookRow = Omit<CurrentReadingBook, 'coverUrl'> & {
  coverPath: string | null;
};

type BookDeviceAggRow = {
  bookMd5: string;
  maxRead: number;
  maxPages: number;
  maxLastOpen: number;
  completedAt: number | null;
};

async function loadBookDeviceAggregates(
  db: DbClient,
): Promise<BookDeviceAggRow[]> {
  const rows = await db
    .select({
      bookMd5: bookDevice.bookMd5,
      maxRead: sql<number>`max(${bookDevice.totalReadPages})`.mapWith(Number),
      maxPages: sql<number>`max(${bookDevice.pages})`.mapWith(Number),
      maxLastOpen:
        sql<number>`max(coalesce(${bookDevice.lastOpen}, 0))`.mapWith(Number),
      completedAt: book.completedAt,
    })
    .from(bookDevice)
    .innerJoin(book, eq(book.md5, bookDevice.bookMd5))
    .where(eq(book.hidden, false))
    .groupBy(bookDevice.bookMd5);
  return rows;
}

function pickCurrentReadingBookMd5(rows: BookDeviceAggRow[]): string | null {
  const unfinished = rows.filter(
    (x) =>
      x.completedAt == null &&
      (x.maxPages ?? 0) > 0 &&
      (x.maxRead ?? 0) < (x.maxPages ?? 0),
  );
  if (unfinished.length === 0) return null;
  unfinished.sort((a, b) => (b.maxLastOpen ?? 0) - (a.maxLastOpen ?? 0));
  return unfinished[0]?.bookMd5 ?? null;
}

/**
 * The Visible Book that is unfinished with the highest recent `lastOpen` across BookDevice rows.
 */
export async function currentReadingBook(
  db: DbClient,
): Promise<CurrentReadingBookRow | null> {
  const rows = await loadBookDeviceAggregates(db);
  const topMd5 = pickCurrentReadingBookMd5(rows);
  if (!topMd5) return null;
  const top = rows.find((r) => r.bookMd5 === topMd5);
  if (!top) return null;

  const [b] = await db.select().from(book).where(eq(book.md5, topMd5)).limit(1);
  if (!b) return null;

  const authors = b.authors?.trim() || null;
  return {
    md5: b.md5,
    displayTitle: displayTitle(b),
    authors,
    coverPath: b.coverPath ?? null,
    pages: top.maxPages ?? 0,
    totalReadPages: top.maxRead ?? 0,
    lastOpen: top.maxLastOpen > 0 ? top.maxLastOpen : null,
  };
}
