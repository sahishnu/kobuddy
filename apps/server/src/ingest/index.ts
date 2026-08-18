import type { KoreaderBook, PageStatPayload } from '@kobuddy/common';
import { book, bookDevice, device, pageStat } from '@kobuddy/db/schema';
import { sql } from 'drizzle-orm';
import type { DbClient } from '../lib/db.js';
import { parseKoreaderStatisticsSqlite } from './koreader-sqlite-parser.js';

export const UNKNOWN_DEVICE_ID = 'unknown-device';

export type IngestResult = {
  booksImported: number;
  pageStatsImported: number;
  pageStatsFiltered: number;
};

/** better-sqlite3 rejects statements with more than 999 bound parameters. */
const SQLITE_MAX_BIND_PARAMS = 999;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function filterSafePageStats(
  newPageStats: PageStatPayload[],
): PageStatPayload[] {
  return newPageStats.filter(
    (s) =>
      s != null &&
      typeof s === 'object' &&
      Number.isFinite(s.duration) &&
      s.duration > 0 &&
      Number.isFinite(s.total_pages) &&
      s.total_pages > 0,
  );
}

/** better-sqlite3 transactions must be synchronous — async callbacks throw. */
export function ingestFromJson(
  db: DbClient,
  booksToImport: KoreaderBook[],
  newPageStats: PageStatPayload[],
): IngestResult {
  const rawStatCount = newPageStats.length;
  const safePageStats = filterSafePageStats(newPageStats);
  const pageStatsFiltered = rawStatCount - safePageStats.length;

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
        deviceId,
        page: s.page,
        startTime: s.start_time,
        duration: s.duration,
        totalPages: s.total_pages,
      }));

      // Chunk to stay under SQLITE_MAX_BIND_PARAMS regardless of column count —
      // a single big VALUES insert overflows it once a backlog builds up
      // (e.g. a device that hasn't synced in months).
      const columnsPerRow = Object.keys(rows[0]).length;
      const batchSize = Math.floor(SQLITE_MAX_BIND_PARAMS / columnsPerRow);

      for (const batch of chunk(rows, batchSize)) {
        tx.insert(pageStat)
          .values(batch)
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
    }
  });

  return {
    booksImported: booksToImport.length,
    pageStatsImported: safePageStats.length,
    pageStatsFiltered,
  };
}

export async function ingestFromKoreaderSqlite(
  db: DbClient,
  file: File,
  deviceId: string,
): Promise<IngestResult> {
  const buf = Buffer.from(await file.arrayBuffer());
  const { books, stats } = parseKoreaderStatisticsSqlite(buf, deviceId);
  return ingestFromJson(db, books, stats);
}

/** Optional multipart field `device_id` — labels page stats (KOReader plugin uses hardware id). */
export function deviceIdFromMultipartField(raw: unknown): string {
  if (typeof raw === 'string') {
    const s = raw.trim().slice(0, 256);
    if (s.length > 0) return s;
  }
  return UNKNOWN_DEVICE_ID;
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

export class KoreaderSqliteMultipartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KoreaderSqliteMultipartError';
  }
}

/** Shared multipart → sqlite ingest path for plugin and admin upload routes. */
export async function ingestKoreaderSqliteFromMultipart(
  db: DbClient,
  body: Record<string, string | File | (string | File)[]>,
): Promise<IngestResult> {
  const file = body.file;
  if (!(file instanceof File)) {
    throw new KoreaderSqliteMultipartError('Expected multipart field "file"');
  }
  const deviceId = deviceIdFromMultipartField(body.device_id);
  return ingestFromKoreaderSqlite(db, file, deviceId);
}
