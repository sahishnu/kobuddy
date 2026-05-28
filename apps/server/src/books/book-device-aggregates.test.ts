import { describe, expect, it } from 'vitest';
import { createInMemoryDb } from '../test-util/in-memory-db.js';
import { seedBook, seedBookDevice, seedDevice } from '../test-util/seed.js';
import {
  isShelfEligible,
  isUnfinishedForCurrentReading,
  loadVisibleBookDeviceAggregates,
  mapLastOpenForWire,
  pickCurrentlyReadingMd5,
  sumMaxReadPagesAcrossBooks,
  totalPagesReadVisible,
} from './book-device-aggregates.js';
import { listBooks } from './books.js';
import { SHELF_MIN_READ_PAGES } from './constants.js';

describe('book-device aggregate predicates', () => {
  it('mapLastOpenForWire returns null when aggregate is zero', () => {
    expect(mapLastOpenForWire(0)).toBeNull();
    expect(mapLastOpenForWire(-1)).toBeNull();
    expect(mapLastOpenForWire(42)).toBe(42);
  });

  it('isShelfEligible matches SHELF_MIN_READ_PAGES and finished rules', () => {
    expect(
      isShelfEligible({ maxRead: SHELF_MIN_READ_PAGES, maxPages: 100 }),
    ).toBe(true);
    expect(
      isShelfEligible({ maxRead: SHELF_MIN_READ_PAGES - 1, maxPages: 100 }),
    ).toBe(false);
    expect(isShelfEligible({ maxRead: 100, maxPages: 100 })).toBe(true);
    expect(isShelfEligible({ maxRead: 1, maxPages: 0 })).toBe(false);
  });

  it('isUnfinishedForCurrentReading requires pages and incomplete read', () => {
    expect(
      isUnfinishedForCurrentReading({
        bookMd5: 'a',
        maxRead: 10,
        maxPages: 100,
        maxLastOpen: 1,
        completedAt: null,
      }),
    ).toBe(true);
    expect(
      isUnfinishedForCurrentReading({
        bookMd5: 'a',
        maxRead: 100,
        maxPages: 100,
        maxLastOpen: 1,
        completedAt: null,
      }),
    ).toBe(false);
    expect(
      isUnfinishedForCurrentReading({
        bookMd5: 'a',
        maxRead: 10,
        maxPages: 100,
        maxLastOpen: 1,
        completedAt: 1,
      }),
    ).toBe(false);
  });

  it('pickCurrentlyReadingMd5 chooses max lastOpen among unfinished', () => {
    const md5 = pickCurrentlyReadingMd5([
      {
        bookMd5: 'low',
        maxRead: 5,
        maxPages: 50,
        maxLastOpen: 10,
        completedAt: null,
      },
      {
        bookMd5: 'high',
        maxRead: 5,
        maxPages: 50,
        maxLastOpen: 900,
        completedAt: null,
      },
    ]);
    expect(md5).toBe('high');
  });
});

describe('loadVisibleBookDeviceAggregates', () => {
  it('maxes across two BookDevice rows for one book', async () => {
    const db = createInMemoryDb();
    seedDevice(db, 'phone');
    seedDevice(db, 'tablet');
    seedBook(db, { md5: 'multi', title: 'M' });
    seedBookDevice(db, {
      bookMd5: 'multi',
      deviceId: 'phone',
      pages: 100,
      totalReadPages: 12,
      lastOpen: null,
    });
    seedBookDevice(db, {
      bookMd5: 'multi',
      deviceId: 'tablet',
      pages: 200,
      totalReadPages: 40,
      lastOpen: 1700,
    });

    const rows = await loadVisibleBookDeviceAggregates(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      bookMd5: 'multi',
      maxRead: 40,
      maxPages: 200,
      maxLastOpen: 1700,
    });
  });

  it('excludes hidden books', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'hid', title: 'H', hidden: true });
    seedBookDevice(db, {
      bookMd5: 'hid',
      pages: 10,
      totalReadPages: 99,
      lastOpen: 1,
    });
    await expect(loadVisibleBookDeviceAggregates(db)).resolves.toEqual([]);
  });
});

describe('totalPagesReadVisible', () => {
  it('sums per-book max read across visible books', async () => {
    const db = createInMemoryDb();
    seedDevice(db);
    seedBook(db, { md5: 'a', title: 'A' });
    seedBook(db, { md5: 'b', title: 'B' });
    seedBookDevice(db, { bookMd5: 'a', pages: 10, totalReadPages: 7 });
    seedBookDevice(db, { bookMd5: 'b', pages: 10, totalReadPages: 3 });
    await expect(totalPagesReadVisible(db)).resolves.toBe(10);
    expect(sumMaxReadPagesAcrossBooks([{ maxRead: 7 }, { maxRead: 3 }])).toBe(
      10,
    );
  });
});

describe('listBooks lastOpen wire mapping', () => {
  it('uses max lastOpen across devices and null when only zeros', async () => {
    const db = createInMemoryDb();
    seedDevice(db, 'd1');
    seedDevice(db, 'd2');
    seedBook(db, { md5: 'x', title: 'X' });
    seedBookDevice(db, {
      bookMd5: 'x',
      deviceId: 'd1',
      pages: 10,
      totalReadPages: 1,
      lastOpen: null,
    });
    seedBookDevice(db, {
      bookMd5: 'x',
      deviceId: 'd2',
      pages: 10,
      totalReadPages: 1,
      lastOpen: 555,
    });

    const rows = await listBooks(db, { showHidden: false, shelfMode: false });
    expect(rows[0]?.lastOpen).toBe(555);
  });
});
