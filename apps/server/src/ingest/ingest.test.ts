import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { KoreaderBook, PageStatPayload } from '@kobuddy/common';
import { bookDevice, device, pageStat } from '@kobuddy/db/schema';
import Database from 'better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createInMemoryDb } from '../test-util/in-memory-db.js';
import { seedBook, seedBookDevice, seedDevice } from '../test-util/seed.js';
import {
  deviceIdFromMultipartField,
  ingestFromJson,
  ingestFromKoreaderSqlite,
  registerDevice,
  UNKNOWN_DEVICE_ID,
} from './index.js';

function book(
  md5: string,
  overrides: Partial<KoreaderBook> = {},
): KoreaderBook {
  return {
    id: 1,
    md5,
    title: 'T',
    authors: 'A',
    notes: 0,
    last_open: 100,
    highlights: 0,
    pages: 200,
    series: '',
    language: 'en',
    total_read_time: 60,
    total_read_pages: 10,
    ...overrides,
  };
}

function stat(overrides: Partial<PageStatPayload> = {}): PageStatPayload {
  return {
    book_md5: 'bk1',
    page: 1,
    start_time: 1_700_000_000,
    duration: 30,
    total_pages: 200,
    device_id: 'default-device',
    ...overrides,
  } as PageStatPayload;
}

describe('deviceIdFromMultipartField', () => {
  it('returns trimmed string up to 256 chars', () => {
    expect(deviceIdFromMultipartField('  my-device  ')).toBe('my-device');
    expect(deviceIdFromMultipartField('x'.repeat(300))).toBe('x'.repeat(256));
  });

  it('returns unknown-device for empty or non-string', () => {
    expect(deviceIdFromMultipartField('')).toBe(UNKNOWN_DEVICE_ID);
    expect(deviceIdFromMultipartField('   ')).toBe(UNKNOWN_DEVICE_ID);
    expect(deviceIdFromMultipartField(undefined)).toBe(UNKNOWN_DEVICE_ID);
    expect(deviceIdFromMultipartField(1)).toBe(UNKNOWN_DEVICE_ID);
  });
});

describe('ingestFromJson — bad-row filter', () => {
  it('drops stats with non-finite or non-positive duration', () => {
    const db = createInMemoryDb();
    const books = [book('bk1')];
    const stats: PageStatPayload[] = [
      stat({ duration: Number.NaN }),
      stat({ duration: 0 }),
      stat({ duration: -1 }),
      stat({ duration: 20 }),
    ];
    const r = ingestFromJson(db, books, stats);
    expect(r.pageStatsFiltered).toBe(3);
    expect(r.pageStatsImported).toBe(1);
    const rows = db.select().from(pageStat).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.duration).toBe(20);
  });

  it('drops stats with non-finite or non-positive total_pages', () => {
    const db = createInMemoryDb();
    const books = [book('bk1')];
    const stats: PageStatPayload[] = [
      stat({ total_pages: Number.POSITIVE_INFINITY }),
      stat({ total_pages: 0 }),
      stat({ total_pages: 5 }),
    ];
    const r = ingestFromJson(db, books, stats);
    expect(r.pageStatsFiltered).toBe(2);
    expect(r.pageStatsImported).toBe(1);
  });

  it('drops null-like entries in the stats array', () => {
    const db = createInMemoryDb();
    const books = [book('bk1')];
    // biome-ignore lint/suspicious/noExplicitAny: exercising runtime filter
    const stats = [null, {}, stat()] as any[];
    const r = ingestFromJson(db, books, stats);
    expect(r.pageStatsFiltered).toBe(2);
    expect(r.pageStatsImported).toBe(1);
  });
});

describe('ingestFromJson — large batches', () => {
  it('imports more page stats than fit in a single SQLite statement (999 bound params)', () => {
    const db = createInMemoryDb();
    const books = [book('bk1')];
    const stats: PageStatPayload[] = Array.from({ length: 6284 }, (_, i) =>
      stat({ page: i, start_time: 1_700_000_000 + i }),
    );
    const r = ingestFromJson(db, books, stats);
    expect(r.pageStatsImported).toBe(6284);
    expect(r.pageStatsFiltered).toBe(0);
    const rows = db.select().from(pageStat).all();
    expect(rows).toHaveLength(6284);
  });
});

describe('ingestFromJson — device selection', () => {
  it('uses first non-empty device_id among safe stats', () => {
    const db = createInMemoryDb();
    const books = [book('bk1')];
    const stats: PageStatPayload[] = [
      stat({ device_id: '', duration: 0, total_pages: 0 }),
      stat({ device_id: 'dev-a' }),
      stat({ device_id: 'dev-b' }),
    ];
    ingestFromJson(db, books, stats);
    const devRows = db.select().from(device).all();
    expect(devRows.map((d) => d.id).sort()).toEqual(['dev-a']);
    const ps = db.select().from(pageStat).all();
    expect(ps.every((p) => p.deviceId === 'dev-a')).toBe(true);
  });

  it('uses unknown-device when no safe stat carries device_id', () => {
    const db = createInMemoryDb();
    const books = [book('bk1')];
    const stats: PageStatPayload[] = [
      stat({ device_id: undefined, duration: 10, total_pages: 10 }),
    ];
    ingestFromJson(db, books, stats);
    const devRows = db.select().from(device).all();
    expect(devRows.some((d) => d.id === UNKNOWN_DEVICE_ID)).toBe(true);
    expect(db.select().from(pageStat).all()[0]?.deviceId).toBe(
      UNKNOWN_DEVICE_ID,
    );
  });
});

describe('ingestFromJson — book_device merge', () => {
  it('does not overwrite positive totalReadPages with zero from payload', () => {
    const db = createInMemoryDb();
    seedBook(db, { md5: 'bk1' });
    seedDevice(db, 'd1');
    seedBookDevice(db, {
      bookMd5: 'bk1',
      deviceId: 'd1',
      pages: 200,
      totalReadPages: 50,
      lastOpen: 500,
      totalReadTime: 3600,
    });
    const books = [
      book('bk1', { total_read_pages: 0, total_read_time: 0, last_open: 0 }),
    ];
    ingestFromJson(db, books, [stat({ device_id: 'd1' })]);
    const [bd] = db
      .select()
      .from(bookDevice)
      .where(and(eq(bookDevice.bookMd5, 'bk1'), eq(bookDevice.deviceId, 'd1')))
      .all();
    expect(bd?.totalReadPages).toBe(50);
    expect(bd?.totalReadTime).toBe(3600);
    expect(bd?.lastOpen).toBe(500);
  });

  it('applies positive counters from a newer payload', () => {
    const db = createInMemoryDb();
    seedBook(db, { md5: 'bk1' });
    seedDevice(db, 'd1');
    seedBookDevice(db, {
      bookMd5: 'bk1',
      deviceId: 'd1',
      pages: 100,
      totalReadPages: 5,
      lastOpen: 1,
    });
    const books = [
      book('bk1', {
        total_read_pages: 99,
        total_read_time: 9999,
        last_open: 888,
      }),
    ];
    ingestFromJson(db, books, [stat({ device_id: 'd1' })]);
    const [bd] = db
      .select()
      .from(bookDevice)
      .where(and(eq(bookDevice.bookMd5, 'bk1'), eq(bookDevice.deviceId, 'd1')))
      .all();
    expect(bd?.totalReadPages).toBe(99);
    expect(bd?.totalReadTime).toBe(9999);
    expect(bd?.lastOpen).toBe(888);
  });
});

describe('ingestFromJson — page_stat conflict', () => {
  it('updates duration and totalPages on duplicate natural key', () => {
    const db = createInMemoryDb();
    const books = [book('bk1')];
    const s = stat({ device_id: 'd1' });
    ingestFromJson(db, books, [s]);
    ingestFromJson(db, books, [{ ...s, duration: 99, total_pages: 50 }]);
    const rows = db.select().from(pageStat).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.duration).toBe(99);
    expect(rows[0]?.totalPages).toBe(50);
  });
});

describe('registerDevice', () => {
  it('inserts then updates model on conflict', async () => {
    const db = createInMemoryDb();
    await registerDevice(db, 'r1', 'Kindle');
    let rows = await db.select().from(device).where(eq(device.id, 'r1'));
    expect(rows[0]?.model).toBe('Kindle');
    await registerDevice(db, 'r1', 'Kobo');
    rows = await db.select().from(device).where(eq(device.id, 'r1'));
    expect(rows[0]?.model).toBe('Kobo');
  });
});

describe('ingestFromKoreaderSqlite', () => {
  it('parses upload and returns filtered counts for bad stat rows', async () => {
    const db = createInMemoryDb();

    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'kobuddy-ingest-sqlite-'),
    );
    const fp = path.join(dir, 'statistics.sqlite3');
    const raw = new Database(fp);
    raw.exec(`
      CREATE TABLE book (
        id integer PRIMARY KEY autoincrement,
        title text, authors text, notes integer, last_open integer, highlights integer,
        pages integer, series text, language text, md5 text, total_read_time integer, total_read_pages integer
      );
      CREATE TABLE page_stat_data (
        id_book integer, page integer NOT NULL DEFAULT 0, start_time integer NOT NULL DEFAULT 0,
        duration integer NOT NULL DEFAULT 0, total_pages integer NOT NULL DEFAULT 0,
        UNIQUE (id_book, page, start_time),
        FOREIGN KEY(id_book) REFERENCES book(id)
      );
    `);
    raw
      .prepare(
        `INSERT INTO book (title, authors, notes, last_open, highlights, pages, series, language, md5, total_read_time, total_read_pages)
         VALUES ('T', 'A', 0, 1, 0, 100, '', 'en', 'sqlmd5', 1, 1)`,
      )
      .run();
    raw
      .prepare(
        `INSERT INTO page_stat_data (id_book, page, start_time, duration, total_pages) VALUES
         (1, 1, 1700000001, 0, 100),
         (1, 2, 1700000002, 60, 100)`,
      )
      .run();
    raw.close();
    const buf = fs.readFileSync(fp);
    fs.unlinkSync(fp);
    fs.rmdirSync(dir);

    const file = new File([buf], 'statistics.sqlite3', {
      type: 'application/x-sqlite3',
    });
    const r = await ingestFromKoreaderSqlite(db, file, 'sqlite-dev');
    expect(r.booksImported).toBe(1);
    expect(r.pageStatsImported).toBe(1);
    expect(r.pageStatsFiltered).toBe(1);
    expect(db.select().from(pageStat).all()).toHaveLength(1);
  });
});
