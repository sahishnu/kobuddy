import { describe, expect, it } from 'vitest';
import { createInMemoryDb } from '../test-util/in-memory-db.js';
import { seedBook, seedBookDevice, seedDevice } from '../test-util/seed.js';
import { currentReadingBook } from './current-reading.js';

describe('currentReadingBook', () => {
  it('returns null when the DB is empty', async () => {
    const db = createInMemoryDb();
    await expect(currentReadingBook(db)).resolves.toBeNull();
  });

  it('decorates one in-progress visible book correctly', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, {
      md5: 'aaa',
      title: 'T',
      customTitle: 'Custom',
      authors: '  Auth  ',
      coverPath: 'covers/aaa.jpg',
    });
    seedBookDevice(db, {
      bookMd5: 'aaa',
      pages: 100,
      totalReadPages: 40,
      lastOpen: 1700001000,
    });

    await expect(currentReadingBook(db)).resolves.toEqual({
      md5: 'aaa',
      displayTitle: 'Custom',
      authors: 'Auth',
      coverPath: 'covers/aaa.jpg',
      pages: 100,
      totalReadPages: 40,
      lastOpen: 1700001000,
    });
  });

  it('picks the higher lastOpen when two books are in progress', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'low', title: 'L' });
    seedBookDevice(db, {
      bookMd5: 'low',
      pages: 50,
      totalReadPages: 10,
      lastOpen: 100,
    });
    seedBook(db, { md5: 'high', title: 'H' });
    seedBookDevice(db, {
      bookMd5: 'high',
      pages: 50,
      totalReadPages: 10,
      lastOpen: 900,
    });

    const cur = await currentReadingBook(db);
    expect(cur?.md5).toBe('high');
  });

  it('prefers in-progress over completed when both exist', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'done', title: 'D', completedAt: 1 });
    seedBookDevice(db, {
      bookMd5: 'done',
      pages: 100,
      totalReadPages: 100,
      lastOpen: 999999,
    });
    seedBook(db, { md5: 'reading', title: 'R' });
    seedBookDevice(db, {
      bookMd5: 'reading',
      pages: 100,
      totalReadPages: 40,
      lastOpen: 100,
    });

    const cur = await currentReadingBook(db);
    expect(cur?.md5).toBe('reading');
  });

  it('returns null when every visible book is finished', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'done', title: 'D' });
    seedBookDevice(db, {
      bookMd5: 'done',
      pages: 80,
      totalReadPages: 80,
      lastOpen: 500,
    });

    await expect(currentReadingBook(db)).resolves.toBeNull();
  });

  it('ignores a hidden book even with a high lastOpen', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, {
      md5: 'hidden',
      title: 'H',
      hidden: true,
    });
    seedBookDevice(db, {
      bookMd5: 'hidden',
      pages: 100,
      totalReadPages: 10,
      lastOpen: 999999999,
    });

    await expect(currentReadingBook(db)).resolves.toBeNull();
  });
});
