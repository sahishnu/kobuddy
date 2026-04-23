import fs from 'node:fs';
import path from 'node:path';
import { zValidator } from '@hono/zod-validator';
import { book, bookDevice, pageStat } from '@kobuddy/db/schema';
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { IronSession } from 'iron-session';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import type { DbClient } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requirePublicReadOrAdmin } from '../middleware/require-public-or-admin.js';
import type { SessionData } from '../middleware/session.js';
import {
  fetchCoverBytes,
  normalizeIsbnForStorage,
  searchCoverCandidates,
  searchIsbnCandidates,
} from '../services/cover-lookup-service.js';
import {
  deviceIdFromMultipartField,
  importStatisticsSqliteFromUpload,
} from '../services/sqlite-statistics-import.js';
import {
  loadBookDeviceAggregates,
  pickCurrentReadingBookMd5,
  SHELF_MIN_READ_PAGES,
} from '../stats/book-device-aggregates.js';

const hideBody = z.object({ hidden: z.boolean() });

const updateBookBody = z.object({
  customTitle: z.string().nullable().optional(),
  authors: z.string().nullable().optional(),
  isbn: z.string().nullable().optional(),
});

const coverAutoBody = z.object({
  provider: z.enum(['openlibrary', 'googlebooks']).optional(),
  providerId: z.string().optional(),
  /** From candidate list; required for Google when applying a picked volume by id. */
  thumbnailUrl: z.string().optional(),
});

const isbnAutoBody = z.object({
  /** When set, stores this ISBN (validated). When omitted, uses first search hit. */
  isbn: z.string().min(1).optional(),
});

function displayTitle(b: { customTitle: string | null; title: string | null }) {
  return b.customTitle || b.title || '(untitled)';
}

async function tryAutoCoverAfterIsbnUpdate(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
  hadManualCover: boolean,
  newIsbn: string | null,
): Promise<void> {
  if (hadManualCover || !newIsbn) return;
  const [b] = await db.select().from(book).where(eq(book.md5, md5)).limit(1);
  if (!b?.isbn) return;
  const candidates = await searchCoverCandidates(
    displayTitle(b),
    b.authors ?? '',
    b.isbn,
    cfg.GOOGLE_BOOKS_API_KEY,
  );
  const first = candidates[0];
  if (!first) return;
  const bytes = await fetchCoverBytes(first, cfg.GOOGLE_BOOKS_API_KEY);
  if (!bytes) return;
  const rel = `covers/${md5}.jpg`;
  const fp = path.join(cfg.DATA_PATH, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, bytes);
  await db
    .update(book)
    .set({
      coverPath: rel,
      coverSource: `${first.provider}:${first.providerId}`,
    })
    .where(eq(book.md5, md5));
}

export function booksRouter(cfg: AppConfig, db: DbClient) {
  const r = new Hono<{
    Variables: { session: IronSession<SessionData> };
  }>();

  r.get('/', requirePublicReadOrAdmin(cfg), async (c) => {
    const showHidden = c.req.query('showHidden') === 'true';
    const sort = c.req.query('sort');
    const shelfMode = c.req.query('shelf') === 'true';
    const limitRaw = c.req.query('limit');
    const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : NaN;
    const limit =
      Number.isFinite(limitParsed) && limitParsed > 0
        ? Math.min(100, limitParsed)
        : undefined;

    let excludeCurrentMd5: string | null = null;
    if (shelfMode) {
      const aggs = await loadBookDeviceAggregates(db);
      excludeCurrentMd5 = pickCurrentReadingBookMd5(aggs);
    }

    const lastOpenAgg =
      sql<number>`max(coalesce(${bookDevice.lastOpen}, 0))`.mapWith(Number);
    const maxReadAgg = sql<number>`max(${bookDevice.totalReadPages})`.mapWith(
      Number,
    );
    const maxPagesAgg = sql<number>`max(${bookDevice.pages})`.mapWith(Number);

    const whereParts = [];
    if (!showHidden) whereParts.push(eq(book.hidden, false));
    if (shelfMode && excludeCurrentMd5) {
      whereParts.push(ne(book.md5, excludeCurrentMd5));
    }
    const whereClause = and(...whereParts) ?? sql`true`;

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
        coverPath: book.coverPath,
        coverSource: book.coverSource,
        lastOpen: sql<number>`max(${bookDevice.lastOpen})`.mapWith(Number),
      })
      .from(book)
      .leftJoin(bookDevice, eq(bookDevice.bookMd5, book.md5))
      .where(whereClause)
      .groupBy(book.md5)
      .$dynamic();

    if (shelfMode) {
      q = q.having(
        sql`(${maxReadAgg} >= ${SHELF_MIN_READ_PAGES} OR (${maxPagesAgg} > 0 AND ${maxReadAgg} >= ${maxPagesAgg}))`,
      );
    }

    if (sort === 'lastOpen') {
      q = q.orderBy(desc(lastOpenAgg), book.md5);
    } else {
      q = q.orderBy(
        asc(sql`lower(coalesce(${book.title}, ${book.customTitle}, ''))`),
        book.md5,
      );
    }

    if (limit != null) {
      q = q.limit(limit);
    }

    const rows = await q;

    return c.json(
      rows.map((b) => ({
        ...b,
        displayTitle: displayTitle(b),
        coverUrl: b.coverPath ? `/api/books/${b.md5}/cover` : null,
      })),
    );
  });

  r.post('/import-sqlite', requireAdmin, async (c) => {
    try {
      const body = await c.req.parseBody({ all: true });
      const file = body.file;
      if (!(file instanceof File)) {
        return c.json({ error: 'Expected multipart field "file"' }, 400);
      }
      const deviceId = deviceIdFromMultipartField(body.device_id);
      const result = await importStatisticsSqliteFromUpload(db, file, deviceId);
      return c.json({
        ok: true,
        message: 'Import successful',
        booksImported: result.booksImported,
        pageStatsImported: result.pageStatsImported,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      return c.json({ error: msg }, 400);
    }
  });

  r.get('/:md5/cover/candidates', requireAdmin, async (c) => {
    const md5 = c.req.param('md5');
    const [b] = await db.select().from(book).where(eq(book.md5, md5)).limit(1);
    if (!b) return c.json({ error: 'Not found' }, 404);
    const q = c.req.query('q');
    const title = q || displayTitle(b);
    const authors = b.authors ?? '';
    const candidates = await searchCoverCandidates(
      title,
      authors,
      b.isbn,
      cfg.GOOGLE_BOOKS_API_KEY,
    );
    return c.json({ candidates });
  });

  r.post(
    '/:md5/cover/auto',
    requireAdmin,
    zValidator('json', coverAutoBody),
    async (c) => {
      const md5 = c.req.param('md5');
      const body = c.req.valid('json');
      const [b] = await db
        .select()
        .from(book)
        .where(eq(book.md5, md5))
        .limit(1);
      if (!b) return c.json({ error: 'Not found' }, 404);

      let candidate = null;
      if (body.provider && body.providerId) {
        candidate = {
          provider: body.provider,
          providerId: body.providerId,
          title: displayTitle(b),
          authors: b.authors ?? '',
          thumbnailUrl: body.thumbnailUrl,
        };
      } else {
        const candidates = await searchCoverCandidates(
          displayTitle(b),
          b.authors ?? '',
          b.isbn,
          cfg.GOOGLE_BOOKS_API_KEY,
        );
        candidate = candidates[0] ?? null;
      }
      if (!candidate) return c.json({ error: 'No cover found' }, 404);
      const bytes = await fetchCoverBytes(candidate, cfg.GOOGLE_BOOKS_API_KEY);
      if (!bytes) return c.json({ error: 'Download failed' }, 502);
      const rel = `covers/${md5}.jpg`;
      const fp = path.join(cfg.DATA_PATH, rel);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, bytes);
      await db
        .update(book)
        .set({
          coverPath: rel,
          coverSource: `${candidate.provider}:${candidate.providerId}`,
        })
        .where(eq(book.md5, md5));
      return c.json({
        ok: true,
        coverSource: `${candidate.provider}:${candidate.providerId}`,
      });
    },
  );

  r.get('/:md5/cover', async (c) => {
    const md5 = c.req.param('md5');
    const [b] = await db.select().from(book).where(eq(book.md5, md5)).limit(1);
    if (!b?.coverPath) return c.body(null, 404);
    const fp = path.join(cfg.DATA_PATH, b.coverPath);
    if (!fs.existsSync(fp)) return c.body(null, 404);
    const buf = fs.readFileSync(fp);
    return new Response(buf, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  });

  r.post('/:md5/cover', requireAdmin, async (c) => {
    const md5 = c.req.param('md5');
    const body = await c.req.parseBody({ all: true });
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: 'Expected multipart field "file"' }, 400);
    }
    const maxBytes = cfg.MAX_COVER_MB * 1024 * 1024;
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > maxBytes) return c.json({ error: 'File too large' }, 400);
    const rel = `covers/${md5}.jpg`;
    const fp = path.join(cfg.DATA_PATH, rel);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, buf);
    await db
      .update(book)
      .set({ coverPath: rel, coverSource: 'manual' })
      .where(eq(book.md5, md5));
    return c.json({ ok: true });
  });

  r.delete('/:md5/cover', requireAdmin, async (c) => {
    const md5 = c.req.param('md5');
    const [b] = await db.select().from(book).where(eq(book.md5, md5)).limit(1);
    if (b?.coverPath) {
      const fp = path.join(cfg.DATA_PATH, b.coverPath);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await db
      .update(book)
      .set({ coverPath: null, coverSource: null })
      .where(eq(book.md5, md5));
    return c.json({ ok: true });
  });

  r.get('/:md5/isbn/candidates', requireAdmin, async (c) => {
    const md5 = c.req.param('md5');
    const [b] = await db.select().from(book).where(eq(book.md5, md5)).limit(1);
    if (!b) return c.json({ error: 'Not found' }, 404);
    const q = c.req.query('q');
    const title = q || displayTitle(b);
    const authors = b.authors ?? '';
    const candidates = await searchIsbnCandidates(
      title,
      authors,
      cfg.GOOGLE_BOOKS_API_KEY,
    );
    return c.json({ candidates });
  });

  r.post(
    '/:md5/isbn/auto',
    requireAdmin,
    zValidator('json', isbnAutoBody),
    async (c) => {
      const md5 = c.req.param('md5');
      const body = c.req.valid('json');
      const [existing] = await db
        .select()
        .from(book)
        .where(eq(book.md5, md5))
        .limit(1);
      if (!existing) return c.json({ error: 'Not found' }, 404);
      const hadManualCover = existing.coverSource === 'manual';

      let nextIsbn: string | null;
      if (body.isbn) {
        nextIsbn = normalizeIsbnForStorage(body.isbn);
        if (!nextIsbn) return c.json({ error: 'Invalid ISBN' }, 400);
      } else {
        const list = await searchIsbnCandidates(
          displayTitle(existing),
          existing.authors ?? '',
          cfg.GOOGLE_BOOKS_API_KEY,
        );
        const first = list[0];
        if (!first) return c.json({ error: 'No ISBN found' }, 404);
        nextIsbn = first.isbn;
      }

      await db.update(book).set({ isbn: nextIsbn }).where(eq(book.md5, md5));
      await tryAutoCoverAfterIsbnUpdate(db, cfg, md5, hadManualCover, nextIsbn);
      return c.json({ ok: true, isbn: nextIsbn });
    },
  );

  r.put('/:md5/hide', requireAdmin, zValidator('json', hideBody), async (c) => {
    const md5 = c.req.param('md5');
    const { hidden } = c.req.valid('json');
    await db.update(book).set({ hidden }).where(eq(book.md5, md5));
    return c.json({ ok: true });
  });

  r.get('/:md5', requirePublicReadOrAdmin(cfg), async (c) => {
    const md5 = c.req.param('md5');
    const [b] = await db.select().from(book).where(eq(book.md5, md5)).limit(1);
    if (!b) return c.json({ error: 'Not found' }, 404);
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
    return c.json({
      book: {
        ...b,
        displayTitle: displayTitle(b),
        coverUrl: b.coverPath ? `/api/books/${b.md5}/cover` : null,
      },
      devices,
      pageStats: stats,
    });
  });

  r.put(
    '/:md5',
    requireAdmin,
    zValidator('json', updateBookBody),
    async (c) => {
      const md5 = c.req.param('md5');
      const patch = c.req.valid('json');
      const [existing] = await db
        .select()
        .from(book)
        .where(eq(book.md5, md5))
        .limit(1);
      if (!existing) return c.json({ error: 'Not found' }, 404);
      await db.update(book).set(patch).where(eq(book.md5, md5));
      const hadManualCover = existing.coverSource === 'manual';
      const isbnChanged =
        patch.isbn !== undefined && patch.isbn !== existing.isbn;
      const newIsbn = patch.isbn ?? existing.isbn;
      if (isbnChanged) {
        await tryAutoCoverAfterIsbnUpdate(
          db,
          cfg,
          md5,
          hadManualCover,
          newIsbn,
        );
      }
      return c.json({ ok: true });
    },
  );

  return r;
}
