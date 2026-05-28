import type { BookDetail, BookListItem } from '@kobuddy/common';
import { book, bookDevice, pageStat } from '@kobuddy/db/schema';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { normalizeIsbnForStorage } from '../covers/isbn.js';
import type { DbClient } from '../lib/db.js';
import { displayTitle } from '../lib/display.js';
import {
  mapLastOpenForWire,
  maxLastOpenAgg,
  maxPagesAgg,
  maxReadAgg,
  shelfEligibleHaving,
} from './book-device-aggregates.js';
import { currentReadingBook } from './current-reading.js';

export type BookRow = typeof book.$inferSelect;

export async function getBookRow(
  db: DbClient,
  md5: string,
): Promise<BookRow | null> {
  const [b] = await db.select().from(book).where(eq(book.md5, md5)).limit(1);
  return b ?? null;
}

export const ADMIN_BOOKS_DEFAULT_PAGE_SIZE = 25;
export const ADMIN_BOOKS_MAX_PAGE_SIZE = 100;

export type ListBooksOptions = {
  showHidden: boolean;
  /** When true, only hidden books (admin). Ignored if `showHidden` is false and not admin paginated. */
  hiddenOnly?: boolean;
  sort?: 'lastOpen';
  shelfMode: boolean;
  limit?: number;
  offset?: number;
  search?: string;
};

export type ListBooksPageOptions = Omit<
  ListBooksOptions,
  'limit' | 'offset' | 'shelfMode'
> & {
  page: number;
  pageSize: number;
};

type ListBookRow = {
  md5: string;
  title: string | null;
  customTitle: string | null;
  authors: string | null;
  series: string | null;
  language: string | null;
  isbn: string | null;
  hidden: boolean;
  completedAt: number | null;
  coverPath: string | null;
  coverSource: string | null;
  maxLastOpen: number | null;
  totalReadTime: number;
  totalReadPages: number;
  pages: number;
  percentComplete: number;
};

function bookSearchCondition(needle: string) {
  const n = needle.toLowerCase();
  return sql`instr(lower(
    coalesce(${book.title}, '') || ' ' ||
    coalesce(${book.customTitle}, '') || ' ' ||
    coalesce(${book.authors}, '') || ' ' ||
    coalesce(${book.series}, '') || ' ' ||
    coalesce(${book.isbn}, '') || ' ' ||
    ${book.md5}
  ), ${n}) > 0`;
}

function buildListBooksWhere(
  opts: Pick<ListBooksOptions, 'showHidden' | 'hiddenOnly' | 'search'>,
  excludeCurrentMd5: string | null,
  shelfMode: boolean,
) {
  const whereParts = [];
  if (opts.hiddenOnly) {
    whereParts.push(eq(book.hidden, true));
  } else if (!opts.showHidden) {
    whereParts.push(eq(book.hidden, false));
  }
  if (shelfMode && excludeCurrentMd5) {
    whereParts.push(ne(book.md5, excludeCurrentMd5));
  }
  const search = opts.search?.trim();
  if (search) whereParts.push(bookSearchCondition(search));
  return and(...whereParts) ?? sql`true`;
}

function mapListBookRows(
  rows: ListBookRow[],
): Omit<BookListItem, 'coverUrl'>[] {
  return rows.map((b) => {
    const { maxLastOpen, ...rest } = b;
    return {
      ...rest,
      lastOpen: mapLastOpenForWire(maxLastOpen ?? 0),
      completed: b.completedAt != null,
      displayTitle: displayTitle(b),
    };
  });
}

async function countListBooks(
  db: DbClient,
  whereClause: ReturnType<typeof buildListBooksWhere>,
  shelfMode: boolean,
): Promise<number> {
  if (!shelfMode) {
    const [row] = await db
      .select({
        count: sql<number>`count(distinct ${book.md5})`.mapWith(Number),
      })
      .from(book)
      .leftJoin(bookDevice, eq(bookDevice.bookMd5, book.md5))
      .where(whereClause);
    return row?.count ?? 0;
  }
  const rows = await db
    .select({ md5: book.md5 })
    .from(book)
    .leftJoin(bookDevice, eq(bookDevice.bookMd5, book.md5))
    .where(whereClause)
    .groupBy(book.md5)
    .having(shelfEligibleHaving());
  return rows.length;
}

async function queryListBookRows(
  db: DbClient,
  opts: ListBooksOptions,
  excludeCurrentMd5: string | null,
): Promise<ListBookRow[]> {
  const { sort, shelfMode, limit, offset } = opts;
  const whereClause = buildListBooksWhere(opts, excludeCurrentMd5, shelfMode);

  let q = db
    .select({
      md5: book.md5,
      title: book.title,
      customTitle: book.customTitle,
      authors: book.authors,
      series: book.series,
      language: book.language,
      isbn: book.isbn,
      hidden: book.hidden,
      completedAt: book.completedAt,
      coverPath: book.coverPath,
      coverSource: book.coverSource,
      maxLastOpen: maxLastOpenAgg,
      totalReadTime:
        sql<number>`coalesce(sum(${bookDevice.totalReadTime}), 0)`.mapWith(
          Number,
        ),
      totalReadPages: sql<number>`coalesce(${maxReadAgg}, 0)`.mapWith(Number),
      pages: sql<number>`coalesce(${maxPagesAgg}, 0)`.mapWith(Number),
      percentComplete:
        sql<number>`coalesce(max(case when ${bookDevice.pages} > 0 then ${bookDevice.totalReadPages} * 100 / ${bookDevice.pages} else 0 end), 0)`.mapWith(
          Number,
        ),
    })
    .from(book)
    .leftJoin(bookDevice, eq(bookDevice.bookMd5, book.md5))
    .where(whereClause)
    .groupBy(book.md5)
    .$dynamic();

  if (shelfMode) {
    q = q.having(shelfEligibleHaving());
  }

  if (sort === 'lastOpen') {
    q = q.orderBy(desc(maxLastOpenAgg), book.md5);
  } else {
    q = q.orderBy(
      asc(sql`lower(coalesce(${book.title}, ${book.customTitle}, ''))`),
      book.md5,
    );
  }

  if (limit != null) {
    q = q.limit(limit);
  }
  if (offset != null && offset > 0) {
    q = q.offset(offset);
  }

  return q;
}

export async function listBooks(
  db: DbClient,
  opts: ListBooksOptions,
): Promise<Omit<BookListItem, 'coverUrl'>[]> {
  const { shelfMode } = opts;

  let excludeCurrentMd5: string | null = null;
  if (shelfMode) {
    const cur = await currentReadingBook(db);
    excludeCurrentMd5 = cur?.md5 ?? null;
  }

  const rows = await queryListBookRows(db, opts, excludeCurrentMd5);
  return mapListBookRows(rows);
}

export async function listBooksPage(
  db: DbClient,
  opts: ListBooksPageOptions,
): Promise<{
  items: Omit<BookListItem, 'coverUrl'>[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, opts.page);
  const pageSize = Math.min(
    ADMIN_BOOKS_MAX_PAGE_SIZE,
    Math.max(1, opts.pageSize),
  );
  const offset = (page - 1) * pageSize;
  const listOpts: ListBooksOptions = {
    ...opts,
    shelfMode: false,
    limit: pageSize,
    offset,
  };
  const whereClause = buildListBooksWhere(listOpts, null, false);
  const [total, rows] = await Promise.all([
    countListBooks(db, whereClause, false),
    queryListBookRows(db, listOpts, null),
  ]);
  return {
    items: mapListBookRows(rows),
    total,
    page,
    pageSize,
  };
}

export type GetBookResult = {
  book: Omit<BookDetail, 'coverUrl' | 'createdAt'> & {
    coverPath: string | null;
    createdAt: Date;
  };
  devices: (typeof bookDevice.$inferSelect)[];
  pageStats: (typeof pageStat.$inferSelect)[];
};

export async function getBook(
  db: DbClient,
  md5: string,
): Promise<GetBookResult | null> {
  const b = await getBookRow(db, md5);
  if (!b) return null;
  const devices = await db
    .select()
    .from(bookDevice)
    .where(eq(bookDevice.bookMd5, md5));
  const stats = await db
    .select()
    .from(pageStat)
    .where(eq(pageStat.bookMd5, md5))
    .orderBy(desc(pageStat.startTime))
    .limit(5000);
  return {
    book: {
      md5: b.md5,
      title: b.title,
      customTitle: b.customTitle,
      authors: b.authors,
      series: b.series,
      language: b.language,
      isbn: b.isbn,
      hidden: b.hidden,
      completedAt: b.completedAt,
      coverPath: b.coverPath,
      coverSource: b.coverSource,
      createdAt: b.createdAt,
      displayTitle: displayTitle(b),
    },
    devices,
    pageStats: stats,
  };
}

export type UpdateBookInput = {
  customTitle?: string | null;
  authors?: string | null;
  isbn?: string | null;
  completed?: boolean;
  completedAt?: number | null;
};

export type UpdateBookResult =
  | {
      found: true;
      isbnChanged: boolean;
      hadManualCover: boolean;
      nextIsbn: string | null;
    }
  | { found: false };

export async function updateBook(
  db: DbClient,
  md5: string,
  input: UpdateBookInput,
): Promise<UpdateBookResult> {
  const { completed, completedAt: completedAtOverride, ...rest } = input;
  const [existing] = await db
    .select()
    .from(book)
    .where(eq(book.md5, md5))
    .limit(1);
  if (!existing) return { found: false };

  const patch: typeof rest & { completedAt?: number | null } = { ...rest };
  if (rest.isbn !== undefined) {
    patch.isbn = rest.isbn === null ? null : normalizeIsbnForStorage(rest.isbn);
  }
  if (completedAtOverride !== undefined) {
    patch.completedAt = completedAtOverride;
  } else if (completed === true && existing.completedAt == null) {
    patch.completedAt = Math.floor(Date.now() / 1000);
  } else if (completed === false) {
    patch.completedAt = null;
  }

  await db.update(book).set(patch).where(eq(book.md5, md5));
  const nextIsbn =
    rest.isbn !== undefined ? (patch.isbn ?? null) : existing.isbn;
  const isbnChanged = rest.isbn !== undefined && nextIsbn !== existing.isbn;
  return {
    found: true,
    isbnChanged,
    hadManualCover: existing.coverSource === 'manual',
    nextIsbn,
  };
}

export async function setBookHidden(
  db: DbClient,
  md5: string,
  hidden: boolean,
): Promise<void> {
  await db.update(book).set({ hidden }).where(eq(book.md5, md5));
}
