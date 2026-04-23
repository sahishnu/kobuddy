import type { KoreaderBook, PageStatPayload } from '@kobuddy/common';
import { book, bookDevice, device, pageStat } from '@kobuddy/db/schema';
import { sql } from 'drizzle-orm';
import type { DbClient } from '../lib/db.js';

const UNKNOWN_DEVICE_ID = 'unknown-device';

/** better-sqlite3 transactions must be synchronous — async callbacks throw. */
export function ingestReadingData(
  db: DbClient,
  booksToImport: KoreaderBook[],
  newPageStats: PageStatPayload[],
) {
  const safePageStats = newPageStats.filter(
    (s) =>
      s != null &&
      typeof s === 'object' &&
      Number.isFinite(s.duration) &&
      s.duration > 0 &&
      Number.isFinite(s.total_pages) &&
      s.total_pages > 0,
  );

  const firstDevice = safePageStats.find((s) => s.device_id)?.device_id;
  const deviceId = firstDevice ?? UNKNOWN_DEVICE_ID;

  db.transaction((tx) => {
    if (deviceId === UNKNOWN_DEVICE_ID) {
      tx.insert(device)
        .values({ id: UNKNOWN_DEVICE_ID, model: 'Manual / unknown' })
        .onConflictDoNothing({ target: device.id })
        .run();
    } else {
      tx.insert(device)
        .values({ id: deviceId, model: 'KOReader' })
        .onConflictDoNothing({ target: device.id })
        .run();
    }

    for (const b of booksToImport) {
      tx.insert(book)
        .values({
          md5: b.md5,
          title: b.title || null,
          authors: b.authors || null,
          series: b.series || null,
          language: b.language || null,
        })
        .onConflictDoNothing({ target: book.md5 })
        .run();
    }

    for (const b of booksToImport) {
      tx.insert(bookDevice)
        .values({
          bookMd5: b.md5,
          deviceId,
          lastOpen: b.last_open,
          pages: b.pages,
          notes: b.notes,
          highlights: b.highlights,
          totalReadTime: b.total_read_time ?? 0,
          totalReadPages: b.total_read_pages ?? 0,
        })
        .onConflictDoUpdate({
          target: [bookDevice.bookMd5, bookDevice.deviceId],
          set: {
            pages: sql`excluded.pages`,
            notes: sql`excluded.notes`,
            highlights: sql`excluded.highlights`,
            lastOpen: sql`CASE WHEN excluded.last_open > 0 THEN excluded.last_open ELSE book_device.last_open END`,
            totalReadTime: sql`CASE WHEN excluded.total_read_time > 0 THEN excluded.total_read_time ELSE book_device.total_read_time END`,
            totalReadPages: sql`CASE WHEN excluded.total_read_pages > 0 THEN excluded.total_read_pages ELSE book_device.total_read_pages END`,
          },
        })
        .run();
    }

    if (safePageStats.length > 0) {
      const rows = safePageStats.map((s) => ({
        bookMd5: s.book_md5,
        deviceId: s.device_id ?? deviceId,
        page: s.page,
        startTime: s.start_time,
        duration: s.duration,
        totalPages: s.total_pages,
      }));

      tx.insert(pageStat)
        .values(rows)
        .onConflictDoUpdate({
          target: [
            pageStat.deviceId,
            pageStat.bookMd5,
            pageStat.page,
            pageStat.startTime,
          ],
          set: {
            duration: sql`excluded.duration`,
            totalPages: sql`excluded.total_pages`,
          },
        })
        .run();
    }
  });
}

export async function registerDevice(db: DbClient, id: string, model: string) {
  await db
    .insert(device)
    .values({ id, model })
    .onConflictDoUpdate({
      target: device.id,
      set: { model: sql`excluded.model` },
    });
}
