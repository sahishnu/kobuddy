import type { CurrentReadingBook } from '@kobuddy/common';
import { book } from '@kobuddy/db/schema';
import { eq } from 'drizzle-orm';
import type { DbClient } from '../lib/db.js';
import { displayTitle } from '../lib/display.js';
import {
  loadVisibleBookDeviceAggregates,
  mapLastOpenForWire,
  pickCurrentlyReadingMd5,
} from './book-device-aggregates.js';

/** Core fields for the current-reading card; add `coverUrl` at the stats HTTP layer. */
export type CurrentReadingBookRow = Omit<CurrentReadingBook, 'coverUrl'> & {
  coverPath: string | null;
};

/**
 * The Visible Book that is unfinished with the highest recent `lastOpen` across BookDevice rows.
 */
export async function currentReadingBook(
  db: DbClient,
): Promise<CurrentReadingBookRow | null> {
  const rows = await loadVisibleBookDeviceAggregates(db);
  const topMd5 = pickCurrentlyReadingMd5(rows);
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
    lastOpen: mapLastOpenForWire(top.maxLastOpen),
  };
}
