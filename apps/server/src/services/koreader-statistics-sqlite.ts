import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { KoreaderBook, PageStatPayload } from '@kobuddy/common';
import Database from 'better-sqlite3';

/** Matches KOReader `settings/statistics.sqlite3` (plugins/statistics.koplugin). */
export const MAX_KOREADER_STATISTICS_SQLITE_BYTES = 64 * 1024 * 1024;

function str(v: unknown): string {
  if (v == null || v === '') return '';
  return String(v);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseKoreaderStatisticsSqlite(
  buffer: Buffer,
  deviceId: string,
): { books: KoreaderBook[]; stats: PageStatPayload[] } {
  if (buffer.length === 0) {
    throw new Error('Empty file');
  }
  if (buffer.length > MAX_KOREADER_STATISTICS_SQLITE_BYTES) {
    throw new Error(
      `File too large (max ${MAX_KOREADER_STATISTICS_SQLITE_BYTES / 1024 / 1024} MiB)`,
    );
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kobuddy-koreader-'));
  const fp = path.join(dir, 'statistics.sqlite3');
  let db: Database.Database | undefined;

  try {
    fs.writeFileSync(fp, buffer);
    db = new Database(fp, { readonly: true });

    let bookRows: Record<string, unknown>[];
    let statRows: Record<string, unknown>[];
    try {
      bookRows = db
        .prepare(
          `SELECT id, title, authors, notes, last_open, highlights, pages, series, language, md5, total_read_time, total_read_pages
           FROM book`,
        )
        .all() as Record<string, unknown>[];
    } catch {
      throw new Error(
        'Not a KOReader statistics database (missing or invalid `book` table)',
      );
    }

    try {
      statRows = db
        .prepare(
          `SELECT id_book, page, start_time, duration, total_pages
           FROM page_stat_data`,
        )
        .all() as Record<string, unknown>[];
    } catch {
      throw new Error(
        'Not a KOReader statistics database (missing or invalid `page_stat_data` table)',
      );
    }

    const books: KoreaderBook[] = bookRows
      .map((row) => ({
        id: num(row.id),
        md5: str(row.md5),
        title: str(row.title),
        authors: str(row.authors),
        notes: num(row.notes),
        last_open: num(row.last_open),
        highlights: num(row.highlights),
        pages: num(row.pages),
        series: str(row.series),
        language: str(row.language),
        total_read_time: num(row.total_read_time),
        total_read_pages: num(row.total_read_pages),
      }))
      .filter((b) => b.md5.length > 0);

    const md5ByBookId = new Map<number, string>();
    for (const b of books) {
      md5ByBookId.set(b.id, b.md5);
    }

    const stats: PageStatPayload[] = [];
    for (const row of statRows) {
      const bookId = num(row.id_book);
      const bookMd5 = md5ByBookId.get(bookId);
      if (!bookMd5) continue;

      stats.push({
        page: num(row.page),
        start_time: num(row.start_time),
        duration: num(row.duration),
        total_pages: num(row.total_pages),
        book_md5: bookMd5,
        device_id: deviceId,
      });
    }

    return { books, stats };
  } finally {
    db?.close();
    try {
      fs.unlinkSync(fp);
      fs.rmdirSync(dir);
    } catch {
      /* best-effort temp cleanup */
    }
  }
}
