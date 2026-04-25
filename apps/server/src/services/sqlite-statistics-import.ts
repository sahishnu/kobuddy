import type { DbClient } from '../lib/db.js';
import { ingestReadingData, UNKNOWN_DEVICE_ID } from './ingest-service.js';
import { parseKoreaderStatisticsSqlite } from './koreader-statistics-sqlite.js';

/** Optional multipart field `device_id` — labels page stats (KOReader plugin uses hardware id). */
export function deviceIdFromMultipartField(raw: unknown): string {
  if (typeof raw === 'string') {
    const s = raw.trim().slice(0, 256);
    if (s.length > 0) return s;
  }
  return UNKNOWN_DEVICE_ID;
}

export async function importStatisticsSqliteFromUpload(
  db: DbClient,
  file: File,
  deviceId: string,
): Promise<{ booksImported: number; pageStatsImported: number }> {
  const buf = Buffer.from(await file.arrayBuffer());
  const { books, stats } = parseKoreaderStatisticsSqlite(buf, deviceId);
  ingestReadingData(db, books, stats);
  return {
    booksImported: books.length,
    pageStatsImported: stats.length,
  };
}
