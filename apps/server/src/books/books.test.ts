import { book } from '@kobuddy/db/schema';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { IronSession } from 'iron-session';
import { describe, expect, it } from 'vitest';
import type { AppEnv, SessionData } from '../middleware/session.js';
import { booksRouter } from '../routes/books.js';
import { createInMemoryDb } from '../test-util/in-memory-db.js';
import {
  seedBook,
  seedBookDevice,
  seedDevice,
  seedPageStat,
} from '../test-util/seed.js';
import { testAppConfig } from '../test-util/test-config.js';
import {
  getBook,
  listBooks,
  listBooksPage,
  setBookHidden,
  updateBook,
} from './books.js';
import { SHELF_MIN_READ_PAGES } from './constants.js';

function mockSession(isAdmin: boolean): IronSession<SessionData> {
  return { isAdmin } as IronSession<SessionData>;
}

describe('listBooks', () => {
  it('returns an empty list when there are no books', async () => {
    const db = createInMemoryDb();
    await expect(
      listBooks(db, { showHidden: false, shelfMode: false }),
    ).resolves.toEqual([]);
  });

  it('returns one visible aggregated row', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'a1', title: 'Alpha' });
    seedBookDevice(db, {
      bookMd5: 'a1',
      pages: 100,
      totalReadPages: 10,
      lastOpen: 1000,
    });
    const rows = await listBooks(db, { showHidden: false, shelfMode: false });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.md5).toBe('a1');
    expect(rows[0]?.displayTitle).toBe('Alpha');
    expect(rows[0]?.completed).toBe(false);
    expect(rows[0]?.coverPath).toBeNull();
  });

  it('excludes hidden books when showHidden is false', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'vis', title: 'V' });
    seedBook(db, { md5: 'hid', title: 'H', hidden: true });
    seedBookDevice(db, { bookMd5: 'vis', pages: 10, totalReadPages: 5 });
    seedBookDevice(db, { bookMd5: 'hid', pages: 10, totalReadPages: 5 });
    const rows = await listBooks(db, { showHidden: false, shelfMode: false });
    expect(rows.map((r) => r.md5).sort()).toEqual(['vis']);
  });

  it('includes hidden books when showHidden is true', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'vis', title: 'V' });
    seedBook(db, { md5: 'hid', title: 'H', hidden: true });
    seedBookDevice(db, { bookMd5: 'vis', pages: 10, totalReadPages: 5 });
    seedBookDevice(db, { bookMd5: 'hid', pages: 10, totalReadPages: 5 });
    const rows = await listBooks(db, { showHidden: true, shelfMode: false });
    expect(rows.map((r) => r.md5).sort()).toEqual(['hid', 'vis']);
  });

  it('shelf mode excludes the currently-reading unfinished book', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'cur', title: 'Current' });
    seedBookDevice(db, {
      bookMd5: 'cur',
      pages: 100,
      totalReadPages: 10,
      lastOpen: 999999,
    });
    seedBook(db, { md5: 'shelf', title: 'Shelf' });
    seedBookDevice(db, {
      bookMd5: 'shelf',
      pages: 100,
      totalReadPages: SHELF_MIN_READ_PAGES,
      lastOpen: 1,
    });
    const rows = await listBooks(db, { showHidden: false, shelfMode: true });
    expect(rows.map((r) => r.md5)).toEqual(['shelf']);
  });

  it('respects limit', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'b', title: 'B' });
    seedBook(db, { md5: 'a', title: 'A' });
    seedBookDevice(db, { bookMd5: 'a', pages: 10, totalReadPages: 5 });
    seedBookDevice(db, { bookMd5: 'b', pages: 10, totalReadPages: 5 });
    const rows = await listBooks(db, {
      showHidden: false,
      shelfMode: false,
      limit: 1,
    });
    expect(rows).toHaveLength(1);
  });

  it('paginates visible books for admin', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    for (const letter of ['a', 'b', 'c']) {
      seedBook(db, { md5: letter, title: letter.toUpperCase() });
      seedBookDevice(db, {
        bookMd5: letter,
        pages: 10,
        totalReadPages: 5,
        lastOpen: letter === 'c' ? 300 : letter === 'b' ? 200 : 100,
      });
    }
    const page1 = await listBooksPage(db, {
      showHidden: false,
      page: 1,
      pageSize: 2,
      sort: 'lastOpen',
    });
    expect(page1.total).toBe(3);
    expect(page1.items).toHaveLength(2);
    expect(page1.items[0]?.md5).toBe('c');
    const page2 = await listBooksPage(db, {
      showHidden: false,
      page: 2,
      pageSize: 2,
      sort: 'lastOpen',
    });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]?.md5).toBe('a');
  });

  it('filters by search needle', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'match', title: 'Unique Zebra Title' });
    seedBook(db, { md5: 'other', title: 'Other' });
    seedBookDevice(db, { bookMd5: 'match', pages: 10, totalReadPages: 1 });
    seedBookDevice(db, { bookMd5: 'other', pages: 10, totalReadPages: 1 });
    const result = await listBooksPage(db, {
      showHidden: false,
      page: 1,
      pageSize: 25,
      search: 'zebra',
    });
    expect(result.total).toBe(1);
    expect(result.items[0]?.md5).toBe('match');
  });

  it('lists only hidden books when hiddenOnly is set', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'vis', title: 'V' });
    seedBook(db, { md5: 'hid', title: 'Hidden One', hidden: true });
    seedBookDevice(db, { bookMd5: 'vis', pages: 10, totalReadPages: 5 });
    seedBookDevice(db, { bookMd5: 'hid', pages: 10, totalReadPages: 5 });
    const result = await listBooksPage(db, {
      showHidden: true,
      hiddenOnly: true,
      page: 1,
      pageSize: 25,
    });
    expect(result.total).toBe(1);
    expect(result.items[0]?.md5).toBe('hid');
  });

  it('sorts by lastOpen when requested', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'old', title: 'O' });
    seedBookDevice(db, {
      bookMd5: 'old',
      pages: 10,
      totalReadPages: 5,
      lastOpen: 100,
    });
    seedBook(db, { md5: 'new', title: 'N' });
    seedBookDevice(db, {
      bookMd5: 'new',
      pages: 10,
      totalReadPages: 5,
      lastOpen: 900,
    });
    const rows = await listBooks(db, {
      showHidden: false,
      shelfMode: false,
      sort: 'lastOpen',
    });
    expect(rows[0]?.md5).toBe('new');
    expect(rows[1]?.md5).toBe('old');
  });
});

describe('getBook', () => {
  it('returns null when md5 is missing', async () => {
    const db = createInMemoryDb();
    await expect(getBook(db, 'nope')).resolves.toBeNull();
  });

  it('returns book payload, devices, and page stats', async () => {
    const db = createInMemoryDb();
    seedDevice(db, 'd1');
    seedBook(db, { md5: 'bk', title: 'T' });
    seedBookDevice(db, {
      bookMd5: 'bk',
      deviceId: 'd1',
      pages: 50,
      totalReadPages: 10,
    });
    seedPageStat(db, {
      bookMd5: 'bk',
      deviceId: 'd1',
      page: 1,
      startTime: 1700,
      duration: 60,
      totalPages: 50,
    });
    const out = await getBook(db, 'bk');
    expect(out?.book.md5).toBe('bk');
    expect(out?.devices).toHaveLength(1);
    expect(out?.pageStats).toHaveLength(1);
  });
});

describe('updateBook', () => {
  it('returns found false when md5 is missing', async () => {
    const db = createInMemoryDb();
    await expect(updateBook(db, 'x', { customTitle: 'n' })).resolves.toEqual({
      found: false,
    });
  });

  it('updates customTitle', async () => {
    const db = createInMemoryDb();
    seedBook(db, { md5: 'u1', title: 'Orig' });
    const r = await updateBook(db, 'u1', { customTitle: 'New' });
    expect(r).toMatchObject({ found: true, isbnChanged: false });
    const [row] = await db.select().from(book).where(eq(book.md5, 'u1'));
    expect(row?.customTitle).toBe('New');
  });

  it('sets completedAt when completed becomes true', async () => {
    const db = createInMemoryDb();
    seedBook(db, { md5: 'c1', title: 'C' });
    const before = await updateBook(db, 'c1', { completed: true });
    expect(before.found).toBe(true);
    const [row] = await db.select().from(book).where(eq(book.md5, 'c1'));
    expect(row?.completedAt).not.toBeNull();
  });

  it('reports isbnChanged and nextIsbn when ISBN changes', async () => {
    const db = createInMemoryDb();
    seedBook(db, { md5: 'i1', title: 'T', authors: null });
    await db
      .update(book)
      .set({ isbn: '9780000000002' })
      .where(eq(book.md5, 'i1'));
    const r = await updateBook(db, 'i1', { isbn: '9780000000003' });
    expect(r).toMatchObject({
      found: true,
      isbnChanged: true,
      nextIsbn: '9780000000003',
    });
  });

  it('normalizes hyphenated ISBN on update', async () => {
    const db = createInMemoryDb();
    seedBook(db, { md5: 'i3', title: 'T' });
    await updateBook(db, 'i3', { isbn: '978-0-306-40615-7' });
    const [row] = await db.select().from(book).where(eq(book.md5, 'i3'));
    expect(row?.isbn).toBe('9780306406157');
  });

  it('does not flag isbnChanged when normalized value is unchanged', async () => {
    const db = createInMemoryDb();
    seedBook(db, { md5: 'i4', title: 'T' });
    await db
      .update(book)
      .set({ isbn: '9780306406157' })
      .where(eq(book.md5, 'i4'));
    const r = await updateBook(db, 'i4', { isbn: '978-0-306-40615-7' });
    expect(r).toMatchObject({
      found: true,
      isbnChanged: false,
      nextIsbn: '9780306406157',
    });
  });

  it('does not flag isbnChanged when ISBN unchanged', async () => {
    const db = createInMemoryDb();
    seedBook(db, { md5: 'i2', title: 'T' });
    await db
      .update(book)
      .set({ isbn: '9780000000002' })
      .where(eq(book.md5, 'i2'));
    const r = await updateBook(db, 'i2', { authors: 'A' });
    expect(r).toMatchObject({
      found: true,
      isbnChanged: false,
      nextIsbn: '9780000000002',
    });
  });
});

describe('setBookHidden', () => {
  it('persists hidden flag', async () => {
    const db = createInMemoryDb();
    seedBook(db, { md5: 'h1', title: 'H' });
    await setBookHidden(db, 'h1', true);
    const [row] = await db.select().from(book).where(eq(book.md5, 'h1'));
    expect(row?.hidden).toBe(true);
  });
});

describe('GET /api/books pagination', () => {
  it('returns BookListPage when page query is set', async () => {
    const db = createInMemoryDb();
    const cfg = testAppConfig({ PUBLIC_READ: true });
    seedDevice(db);
    seedBook(db, { md5: 'a', title: 'A' });
    seedBook(db, { md5: 'b', title: 'B' });
    seedBookDevice(db, { bookMd5: 'a', pages: 10, totalReadPages: 5 });
    seedBookDevice(db, { bookMd5: 'b', pages: 10, totalReadPages: 5 });

    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('session', mockSession(true));
      await next();
    });
    app.route('/books', booksRouter(cfg, db));

    const res = await app.request('http://t/books?page=1&pageSize=1');
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      items: { md5: string }[];
      total: number;
      page: number;
      pageSize: number;
    };
    expect(data.total).toBe(2);
    expect(data.items).toHaveLength(1);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(1);
  });

  it('returns BookListPage for anonymous readers when PUBLIC_READ is true', async () => {
    const db = createInMemoryDb();
    const cfg = testAppConfig({ PUBLIC_READ: true });
    seedDevice(db);
    seedBook(db, { md5: 'a', title: 'A' });
    seedBook(db, { md5: 'b', title: 'B' });
    seedBookDevice(db, { bookMd5: 'a', pages: 10, totalReadPages: 5 });
    seedBookDevice(db, { bookMd5: 'b', pages: 10, totalReadPages: 5 });

    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('session', mockSession(false));
      await next();
    });
    app.route('/books', booksRouter(cfg, db));

    const res = await app.request('http://t/books?page=1&pageSize=1');
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      items: { md5: string }[];
      total: number;
    };
    expect(data.total).toBe(2);
    expect(data.items).toHaveLength(1);
  });

  it('honors showHidden=true on paginated admin requests', async () => {
    const db = createInMemoryDb();
    const cfg = testAppConfig({ PUBLIC_READ: true });
    seedDevice(db);
    seedBook(db, { md5: 'vis', title: 'Visible' });
    seedBook(db, { md5: 'hid', title: 'Hidden', hidden: true });
    seedBookDevice(db, { bookMd5: 'vis', pages: 10, totalReadPages: 5 });
    seedBookDevice(db, { bookMd5: 'hid', pages: 10, totalReadPages: 5 });

    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('session', mockSession(true));
      await next();
    });
    app.route('/books', booksRouter(cfg, db));

    const res = await app.request(
      'http://t/books?page=1&pageSize=25&showHidden=true',
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      items: { md5: string }[];
      total: number;
    };
    expect(data.total).toBe(2);
    expect(data.items.map((b) => b.md5).sort()).toEqual(['hid', 'vis']);
  });

  it('ignores hiddenOnly for non-admin', async () => {
    const db = createInMemoryDb();
    const cfg = testAppConfig({ PUBLIC_READ: true });
    seedDevice(db);
    seedBook(db, { md5: 'vis', title: 'Visible' });
    seedBook(db, { md5: 'hid', title: 'Hidden', hidden: true });
    seedBookDevice(db, { bookMd5: 'vis', pages: 10, totalReadPages: 5 });
    seedBookDevice(db, { bookMd5: 'hid', pages: 10, totalReadPages: 5 });

    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('session', mockSession(false));
      await next();
    });
    app.route('/books', booksRouter(cfg, db));

    const res = await app.request(
      'http://t/books?page=1&pageSize=25&hiddenOnly=true',
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      items: { md5: string }[];
      total: number;
    };
    expect(data.total).toBe(1);
    expect(data.items[0]?.md5).toBe('vis');
  });
});

describe('GET /api/books showHidden gating', () => {
  it('ignores showHidden=true when session is not admin', async () => {
    const db = createInMemoryDb();
    const cfg = testAppConfig({ PUBLIC_READ: true });
    seedDevice(db);
    seedBook(db, { md5: 'vis', title: 'Visible' });
    seedBook(db, { md5: 'hid', title: 'Hidden', hidden: true });
    seedBookDevice(db, { bookMd5: 'vis', pages: 10, totalReadPages: 5 });
    seedBookDevice(db, { bookMd5: 'hid', pages: 10, totalReadPages: 5 });

    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('session', mockSession(false));
      await next();
    });
    app.route('/books', booksRouter(cfg, db));

    const res = await app.request('http://t/books?showHidden=true');
    expect(res.status).toBe(200);
    const data = (await res.json()) as { md5: string }[];
    expect(data.map((x) => x.md5).sort()).toEqual(['vis']);
  });
});
