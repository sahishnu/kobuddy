import { book, bookDevice, device, pageStat } from '@kobuddy/db/schema';
import type { DbClient } from '../lib/db.js';

const DEFAULT_DEVICE_ID = 'device-1';

export function seedDevice(
  db: DbClient,
  id: string = DEFAULT_DEVICE_ID,
  model = 'test',
) {
  db.insert(device).values({ id, model }).run();
}

export type SeedBookInput = {
  md5: string;
  title?: string | null;
  customTitle?: string | null;
  authors?: string | null;
  hidden?: boolean;
  completedAt?: number | null;
  coverPath?: string | null;
};

export function seedBook(db: DbClient, input: SeedBookInput) {
  db.insert(book)
    .values({
      md5: input.md5,
      title: input.title ?? 'Title',
      customTitle: input.customTitle ?? null,
      authors: input.authors ?? null,
      series: null,
      language: 'en',
      hidden: input.hidden ?? false,
      completedAt: input.completedAt ?? null,
      coverPath: input.coverPath ?? null,
      coverSource: null,
    })
    .run();
}

export type SeedBookDeviceInput = {
  bookMd5: string;
  deviceId?: string;
  pages: number;
  totalReadPages: number;
  lastOpen?: number | null;
  totalReadTime?: number;
};

export function seedBookDevice(db: DbClient, input: SeedBookDeviceInput) {
  const deviceId = input.deviceId ?? DEFAULT_DEVICE_ID;
  db.insert(bookDevice)
    .values({
      bookMd5: input.bookMd5,
      deviceId,
      pages: input.pages,
      totalReadPages: input.totalReadPages,
      lastOpen: input.lastOpen ?? null,
      notes: 0,
      highlights: 0,
      totalReadTime: input.totalReadTime ?? 0,
    })
    .run();
}

export type SeedPageStatInput = {
  bookMd5: string;
  deviceId?: string;
  page: number;
  startTime: number;
  duration: number;
  totalPages: number;
};

export function seedPageStat(db: DbClient, input: SeedPageStatInput) {
  const deviceId = input.deviceId ?? DEFAULT_DEVICE_ID;
  db.insert(pageStat)
    .values({
      bookMd5: input.bookMd5,
      deviceId,
      page: input.page,
      startTime: input.startTime,
      duration: input.duration,
      totalPages: input.totalPages,
    })
    .run();
}
