import { book, pageStat } from '@kobuddy/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import { totalPagesReadVisible } from '../books/book-device-aggregates.js';
import type { DbClient } from '../lib/db.js';
import type { PageStatForDashboard } from './stats-dashboard.js';

export async function loadVisiblePageStats(
  db: DbClient,
): Promise<PageStatForDashboard[]> {
  return db
    .select({
      startTime: pageStat.startTime,
      duration: pageStat.duration,
      totalPages: pageStat.totalPages,
      bookMd5: pageStat.bookMd5,
      page: pageStat.page,
      deviceId: pageStat.deviceId,
    })
    .from(pageStat)
    .innerJoin(book, eq(book.md5, pageStat.bookMd5))
    .where(eq(book.hidden, false));
}

export async function totalPagesRead(db: DbClient): Promise<number> {
  return totalPagesReadVisible(db);
}

export async function visibleBookAuthorCounts(
  db: DbClient,
): Promise<{ totalBooks: number; authorValues: (string | null)[] }> {
  const rows = await db
    .select({ authors: book.authors })
    .from(book)
    .where(eq(book.hidden, false));
  return {
    totalBooks: rows.length,
    authorValues: rows.map((x) => x.authors),
  };
}

export async function completedBooksVisible(
  db: DbClient,
): Promise<{ md5: string; completedAt: number }[]> {
  const rows = await db
    .select({ md5: book.md5, completedAt: book.completedAt })
    .from(book)
    .where(and(eq(book.hidden, false), isNotNull(book.completedAt)));
  return rows as { md5: string; completedAt: number }[];
}
