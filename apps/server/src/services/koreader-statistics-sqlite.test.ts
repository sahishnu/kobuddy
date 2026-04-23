import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { parseKoreaderStatisticsSqlite } from './koreader-statistics-sqlite.js';

describe('parseKoreaderStatisticsSqlite', () => {
  it('reads book and page_stat_data like the KOReader plugin', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kobuddy-test-'));
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
         VALUES ('T', 'A', 0, 1, 0, 100, '', 'en', 'abcmd5', 3600, 50)`,
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

    const { books, stats } = parseKoreaderStatisticsSqlite(buf, 'test-device');
    expect(books).toHaveLength(1);
    expect(books[0]?.md5).toBe('abcmd5');
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      page: 3,
      start_time: 1700000000,
      duration: 120,
      total_pages: 100,
      book_md5: 'abcmd5',
      device_id: 'test-device',
    });
  });
});
