import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';

export const device = sqliteTable('device', {
  id: text('id').primaryKey(),
  model: text('model'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const book = sqliteTable(
  'book',
  {
    md5: text('md5').primaryKey(),
    title: text('title'),
    customTitle: text('custom_title'),
    authors: text('authors'),
    series: text('series'),
    language: text('language'),
    isbn: text('isbn'),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    coverPath: text('cover_path'),
    coverSource: text('cover_source'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('book_hidden_idx').on(t.hidden)],
);

export const bookDevice = sqliteTable(
  'book_device',
  {
    bookMd5: text('book_md5')
      .notNull()
      .references(() => book.md5, { onDelete: 'cascade' }),
    deviceId: text('device_id')
      .notNull()
      .references(() => device.id, { onDelete: 'cascade' }),
    lastOpen: integer('last_open'),
    pages: integer('pages'),
    notes: integer('notes'),
    highlights: integer('highlights'),
    totalReadTime: integer('total_read_time').notNull().default(0),
    totalReadPages: integer('total_read_pages').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bookMd5, t.deviceId] })],
);

export const pageStat = sqliteTable(
  'page_stat',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bookMd5: text('book_md5')
      .notNull()
      .references(() => book.md5, { onDelete: 'cascade' }),
    deviceId: text('device_id')
      .notNull()
      .references(() => device.id, { onDelete: 'cascade' }),
    page: integer('page').notNull(),
    /** Unix timestamp in seconds (KOReader payload). */
    startTime: integer('start_time').notNull(),
    duration: integer('duration').notNull(),
    totalPages: integer('total_pages').notNull(),
  },
  (t) => [
    uniqueIndex('page_stat_device_book_page_start').on(
      t.deviceId,
      t.bookMd5,
      t.page,
      t.startTime,
    ),
    index('page_stat_book_idx').on(t.bookMd5),
    index('page_stat_start_idx').on(t.startTime),
  ],
);

export const deviceRelations = relations(device, ({ many }) => ({
  bookDevices: many(bookDevice),
  pageStats: many(pageStat),
}));

export const bookRelations = relations(book, ({ many }) => ({
  bookDevices: many(bookDevice),
  pageStats: many(pageStat),
}));

export const bookDeviceRelations = relations(bookDevice, ({ one }) => ({
  book: one(book, { fields: [bookDevice.bookMd5], references: [book.md5] }),
  device: one(device, {
    fields: [bookDevice.deviceId],
    references: [device.id],
  }),
}));

export const pageStatRelations = relations(pageStat, ({ one }) => ({
  book: one(book, { fields: [pageStat.bookMd5], references: [book.md5] }),
  device: one(device, { fields: [pageStat.deviceId], references: [device.id] }),
}));

export const insertBookSchema = createInsertSchema(book);
export const updateBookSchema = createUpdateSchema(book).pick({
  customTitle: true,
  authors: true,
  isbn: true,
  hidden: true,
});

export const insertDeviceSchema = createInsertSchema(device);
export const insertBookDeviceSchema = createInsertSchema(bookDevice);
export const insertPageStatSchema = createInsertSchema(pageStat);

export type Device = typeof device.$inferSelect;
export type Book = typeof book.$inferSelect;
export type BookDevice = typeof bookDevice.$inferSelect;
export type PageStat = typeof pageStat.$inferSelect;
