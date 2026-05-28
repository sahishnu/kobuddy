import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { statsCache } from '@kobuddy/db/schema';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { ingestRouter } from '../routes/ingest.js';
import { createInMemoryDb } from '../test-util/in-memory-db.js';
import { seedBook, seedDevice, seedPageStat } from '../test-util/seed.js';
import { testAppConfig } from '../test-util/test-config.js';
import {
  getPerMonthReadingTime,
  last7DaysReadTime,
  longestDay,
  mostPagesInADay,
  perDayOfTheWeek,
} from './aggregates.js';
import { statsCalendar, statsForBook, statsOverview } from './index.js';

function buildMinimalKoreaderSqliteBuffer(): Buffer {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kobuddy-stats-test-'));
  const fp = path.join(dir, 'statistics.sqlite3');
  const raw = new Database(fp);
  raw.exec(`
    CREATE TABLE book (
      id integer PRIMARY KEY autoincrement,
      title text,
      authors text,
      notes integer,
      last_open integer,
      highlights integer,
      pages integer,
      series text,
      language text,
      md5 text,
      total_read_time integer,
      total_read_pages integer
    );
    CREATE TABLE page_stat_data (
      id_book integer,
      page integer NOT NULL DEFAULT 0,
      start_time integer NOT NULL DEFAULT 0,
      duration integer NOT NULL DEFAULT 0,
      total_pages integer NOT NULL DEFAULT 0,
      UNIQUE (id_book, page, start_time),
      FOREIGN KEY(id_book) REFERENCES book(id)
    );
  `);
  raw
    .prepare(
      `INSERT INTO book (title, authors, notes, last_open, highlights, pages, series, language, md5, total_read_time, total_read_pages)
       VALUES ('T', 'A', 0, 1, 0, 100, '', 'en', 'sqlbk1', 3600, 50)`,
    )
    .run();
  raw
    .prepare(
      `INSERT INTO page_stat_data (id_book, page, start_time, duration, total_pages) VALUES (1, 3, 1700000000, 120, 100)`,
    )
    .run();
  raw.close();
  const buf = fs.readFileSync(fp);
  fs.unlinkSync(fp);
  fs.rmdirSync(dir);
  return buf;
}

describe('aggregates (timezone-aware month / weekday)', () => {
  it('buckets per-month in the caller time zone (Tokyo vs UTC)', () => {
    const startTime = Math.floor(Date.parse('2024-01-31T15:00:00Z') / 1000);
    const row = {
      startTime,
      duration: 120,
      totalPages: 10,
      bookMd5: 'a',
    };
    const utcMonths = getPerMonthReadingTime([row], 'UTC');
    const tokyoMonths = getPerMonthReadingTime([row], 'Asia/Tokyo');
    expect(utcMonths[0]?.month).toMatch(/January 2024/);
    expect(tokyoMonths[0]?.month).toMatch(/February 2024/);
  });

  it('groups per-day-of-week by civil weekday in the caller time zone', () => {
    const startTime = Math.floor(Date.parse('2024-06-10T02:00:00Z') / 1000);
    const row = {
      startTime,
      duration: 60,
      totalPages: 1,
      bookMd5: 'b',
    };
    const utcDow = perDayOfTheWeek([row], 'UTC');
    const laDow = perDayOfTheWeek([row], 'America/Los_Angeles');
    expect(utcDow[0]?.name).toBe('Monday');
    expect(laDow[0]?.name).toBe('Sunday');
  });

  it('longestDay buckets by civil day in the caller time zone', () => {
    const rowA = {
      startTime: Math.floor(Date.parse('2024-01-31T23:00:00Z') / 1000),
      duration: 100,
      totalPages: 10,
      bookMd5: 'a',
    };
    const rowB = {
      startTime: Math.floor(Date.parse('2024-02-01T01:00:00Z') / 1000),
      duration: 200,
      totalPages: 10,
      bookMd5: 'a',
    };
    expect(longestDay([rowA, rowB], 'UTC')).toBe(200);
    expect(longestDay([rowA, rowB], 'Asia/Tokyo')).toBe(300);
  });

  it('mostPagesInADay counts stat rows per civil day in the caller time zone', () => {
    const rowA = {
      startTime: Math.floor(Date.parse('2024-01-31T23:00:00Z') / 1000),
      duration: 1,
      totalPages: 10,
      bookMd5: 'a',
    };
    const rowB = {
      startTime: Math.floor(Date.parse('2024-02-01T01:00:00Z') / 1000),
      duration: 1,
      totalPages: 10,
      bookMd5: 'b',
    };
    expect(mostPagesInADay([rowA, rowB], 'UTC')).toBe(1);
    expect(mostPagesInADay([rowA, rowB], 'Asia/Tokyo')).toBe(2);
  });

  it('last7DaysReadTime uses civil last-7-days window in the caller time zone', () => {
    const nowMs = Date.parse('2024-06-10T12:00:00Z');
    const row = {
      startTime: Math.floor(Date.parse('2024-06-03T20:00:00Z') / 1000),
      duration: 90,
      totalPages: 1,
      bookMd5: 'x',
    };
    expect(last7DaysReadTime([row], 'UTC', nowMs)).toBe(0);
    expect(last7DaysReadTime([row], 'Asia/Tokyo', nowMs)).toBe(90);
  });
});

describe('statsOverview', () => {
  it('returns zeros and empty structures with no reading data', async () => {
    const db = createInMemoryDb();
    const cfg = testAppConfig();
    const o = await statsOverview(db, cfg, 'UTC');
    expect(o.totalReadingTimeSeconds).toBe(0);
    expect(o.totalPagesRead).toBe(0);
    expect(o.calendar).toEqual([]);
    expect(o.currentBook).toBeNull();
    expect(o.perMonth).toEqual([]);
  });

  it('persists overview in stats_cache after compute', async () => {
    const db = createInMemoryDb();
    const cfg = testAppConfig();
    await statsOverview(db, cfg, 'UTC');
    const rows = await db
      .select()
      .from(statsCache)
      .where(eq(statsCache.key, 'stats:overview:UTC'));
    expect(rows).toHaveLength(1);
  });

  it('second overview request reads from cache (same snapshot key)', async () => {
    const db = createInMemoryDb();
    const cfg = testAppConfig();
    const a = await statsOverview(db, cfg, 'UTC');
    const b = await statsOverview(db, cfg, 'UTC');
    expect(b.totalReadingTimeSeconds).toBe(a.totalReadingTimeSeconds);
    const rows = await db
      .select()
      .from(statsCache)
      .where(eq(statsCache.key, 'stats:overview:UTC'));
    expect(rows).toHaveLength(1);
  });
});

describe('statsCalendar', () => {
  it('matches calendar slice of statsOverview for the same zone', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'bk1' });
    seedPageStat(db, {
      bookMd5: 'bk1',
      page: 1,
      startTime: Math.floor(Date.now() / 1000) - 3600,
      duration: 300,
      totalPages: 100,
    });
    const cfg = testAppConfig();
    const o = await statsOverview(db, cfg, 'Europe/Berlin');
    const cal = await statsCalendar(db, 'Europe/Berlin');
    expect(cal.calendar).toEqual(o.calendar);
  });
});

describe('statsForBook', () => {
  it('returns aggregates for a visible book', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'vis' });
    seedPageStat(db, {
      bookMd5: 'vis',
      page: 2,
      startTime: Math.floor(Date.now() / 1000),
      duration: 90,
      totalPages: 50,
    });
    const s = await statsForBook(db, 'vis', 'UTC');
    expect(s).not.toBeNull();
    expect(s?.bookMd5).toBe('vis');
    expect(s?.totalReadingTimeSeconds).toBe(90);
    expect(s?.statsTimeZone).toBe('UTC');
  });

  it('returns null for a hidden book', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'hid', hidden: true });
    seedPageStat(db, {
      bookMd5: 'hid',
      page: 1,
      startTime: Math.floor(Date.now() / 1000),
      duration: 999,
      totalPages: 10,
    });
    await expect(statsForBook(db, 'hid', 'UTC')).resolves.toBeNull();
  });

  it('returns null when md5 does not exist', async () => {
    const db = createInMemoryDb();
    await expect(statsForBook(db, 'nope', 'UTC')).resolves.toBeNull();
  });
});

describe('ingest routes invalidate stats cache', () => {
  const cfg = testAppConfig();

  async function seedCacheRow(db: ReturnType<typeof createInMemoryDb>) {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(statsCache).values({
      key: 'stats:overview:UTC',
      value: '{}',
      computedAt: now,
    });
  }

  it('POST /ingest/device clears stats_cache', async () => {
    const db = createInMemoryDb();
    await seedCacheRow(db);
    const app = new Hono();
    app.route('/ingest', ingestRouter(cfg, db));
    const res = await app.request('http://t/ingest/device', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.INGEST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 'dev-ingest-1',
        model: 'K',
        version: cfg.REQUIRED_PLUGIN_VERSION,
      }),
    });
    expect(res.status).toBe(200);
    const left = await db.select().from(statsCache);
    expect(left).toHaveLength(0);
  });

  it('POST /ingest/import clears stats_cache', async () => {
    const db = createInMemoryDb();
    await seedCacheRow(db);
    const app = new Hono();
    app.route('/ingest', ingestRouter(cfg, db));
    const res = await app.request('http://t/ingest/import', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.INGEST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: cfg.REQUIRED_PLUGIN_VERSION,
        books: [
          {
            id: 1,
            md5: 'importbk',
            title: 'T',
            notes: 0,
            last_open: 0,
            highlights: 0,
            pages: 10,
            series: '',
            language: 'en',
          },
        ],
        stats: [
          {
            page: 1,
            start_time: Math.floor(Date.now() / 1000),
            duration: 60,
            total_pages: 10,
            book_md5: 'importbk',
            device_id: 'dev-ingest-2',
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const left = await db.select().from(statsCache);
    expect(left).toHaveLength(0);
  });

  it('POST /ingest/import-sqlite clears stats_cache on success', async () => {
    const db = createInMemoryDb();
    await seedCacheRow(db);
    const app = new Hono();
    app.route('/ingest', ingestRouter(cfg, db));

    const buf = buildMinimalKoreaderSqliteBuffer();
    const fd = new FormData();
    fd.set(
      'file',
      new File([buf], 'statistics.sqlite3', {
        type: 'application/octet-stream',
      }),
    );

    const res = await app.request('http://t/ingest/import-sqlite', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.INGEST_TOKEN}` },
      body: fd,
    });
    expect(res.status).toBe(200);
    const left = await db.select().from(statsCache);
    expect(left).toHaveLength(0);
  });
});
