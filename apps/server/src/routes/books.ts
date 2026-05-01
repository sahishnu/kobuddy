import { zValidator } from '@hono/zod-validator';
import type { BookDetail, BookListItem } from '@kobuddy/common';
import { book } from '@kobuddy/db/schema';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  getBook,
  listBooks,
  setBookHidden,
  updateBook,
} from '../books/index.js';
import type { AppConfig } from '../config.js';
import {
  applyCoverCandidate,
  applyCustomCover,
  autoCoverAfterIsbnChange,
  deleteCover,
  listCoverCandidates,
  listIsbnCandidates,
  normalizeIsbnForStorage,
  readCoverBytes,
} from '../covers/index.js';
import {
  deviceIdFromMultipartField,
  ingestFromKoreaderSqlite,
} from '../ingest/index.js';
import type { DbClient } from '../lib/db.js';
import { displayTitle } from '../lib/display.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requirePublicReadOrAdmin } from '../middleware/require-public-or-admin.js';
import type { AppEnv } from '../middleware/session.js';
import { invalidateStatsCache } from '../stats/index.js';

const hideBody = z.object({ hidden: z.boolean() });

const updateBookBody = z.object({
  customTitle: z.string().nullable().optional(),
  authors: z.string().nullable().optional(),
  isbn: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  completedAt: z.number().nullable().optional(),
});

const coverAutoBody = z.object({
  provider: z.enum(['openlibrary', 'googlebooks']).optional(),
  providerId: z.string().optional(),
  thumbnailUrl: z.string().optional(),
});

const isbnAutoBody = z.object({
  isbn: z.string().min(1).optional(),
});

export function booksRouter(cfg: AppConfig, db: DbClient) {
  const r = new Hono<AppEnv>();

  r.get('/', requirePublicReadOrAdmin(cfg), async (c) => {
    const session = c.get('session');
    const showHidden = Boolean(
      session.isAdmin && c.req.query('showHidden') === 'true',
    );
    const sort = c.req.query('sort');
    const shelfMode = c.req.query('shelf') === 'true';
    const limitRaw = c.req.query('limit');
    const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : NaN;
    const limit =
      Number.isFinite(limitParsed) && limitParsed > 0
        ? Math.min(100, limitParsed)
        : undefined;

    const core = await listBooks(db, {
      showHidden,
      sort: sort === 'lastOpen' ? 'lastOpen' : undefined,
      shelfMode,
      limit,
    });
    const list: BookListItem[] = core.map((b) => ({
      ...b,
      coverUrl: b.coverPath ? `/api/books/${b.md5}/cover` : null,
    }));
    return c.json(list);
  });

  r.post('/import-sqlite', requireAdmin, async (c) => {
    try {
      const body = await c.req.parseBody({ all: true });
      const file = body.file;
      if (!(file instanceof File)) {
        return c.json({ error: 'Expected multipart field "file"' }, 400);
      }
      const deviceId = deviceIdFromMultipartField(body.device_id);
      const result = await ingestFromKoreaderSqlite(db, file, deviceId);
      await invalidateStatsCache(db);
      return c.json({
        ok: true,
        message: 'Import successful',
        booksImported: result.booksImported,
        pageStatsImported: result.pageStatsImported,
        pageStatsFiltered: result.pageStatsFiltered,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      return c.json({ error: msg }, 400);
    }
  });

  // --- Cover endpoints ---

  r.get('/:md5/cover/candidates', requireAdmin, async (c) => {
    const md5 = c.req.param('md5');
    const [b] = await db.select().from(book).where(eq(book.md5, md5)).limit(1);
    if (!b) return c.json({ error: 'Not found' }, 404);
    const q = c.req.query('q');
    const title = q || displayTitle(b);
    const authors = b.authors ?? '';
    const candidates = await listCoverCandidates(cfg, title, authors, b.isbn);
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
        const candidates = await listCoverCandidates(
          cfg,
          displayTitle(b),
          b.authors ?? '',
          b.isbn,
        );
        candidate = candidates[0] ?? null;
      }
      if (!candidate) return c.json({ error: 'No cover found' }, 404);
      const ok = await applyCoverCandidate(db, cfg, md5, candidate);
      if (!ok) return c.json({ error: 'Download failed' }, 502);
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
    const buf = await readCoverBytes(cfg, b.coverPath);
    if (!buf) return c.body(null, 404);
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
    await applyCustomCover(db, cfg, md5, buf);
    return c.json({ ok: true });
  });

  r.delete('/:md5/cover', requireAdmin, async (c) => {
    const md5 = c.req.param('md5');
    await deleteCover(db, cfg, md5);
    return c.json({ ok: true });
  });

  // --- ISBN endpoints ---

  r.get('/:md5/isbn/candidates', requireAdmin, async (c) => {
    const md5 = c.req.param('md5');
    const [b] = await db.select().from(book).where(eq(book.md5, md5)).limit(1);
    if (!b) return c.json({ error: 'Not found' }, 404);
    const q = c.req.query('q');
    const title = q || displayTitle(b);
    const authors = b.authors ?? '';
    const candidates = await listIsbnCandidates(cfg, title, authors);
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
        const list = await listIsbnCandidates(
          cfg,
          displayTitle(existing),
          existing.authors ?? '',
        );
        const first = list[0];
        if (!first) return c.json({ error: 'No ISBN found' }, 404);
        nextIsbn = first.isbn;
      }

      await db.update(book).set({ isbn: nextIsbn }).where(eq(book.md5, md5));
      await autoCoverAfterIsbnChange(db, cfg, md5, hadManualCover, nextIsbn);
      return c.json({ ok: true, isbn: nextIsbn });
    },
  );

  // --- Book CRUD ---

  r.put('/:md5/hide', requireAdmin, zValidator('json', hideBody), async (c) => {
    const md5 = c.req.param('md5');
    const { hidden } = c.req.valid('json');
    await setBookHidden(db, md5, hidden);
    return c.json({ ok: true });
  });

  r.get('/:md5', requirePublicReadOrAdmin(cfg), async (c) => {
    const md5 = c.req.param('md5');
    const out = await getBook(db, md5);
    if (!out) return c.json({ error: 'Not found' }, 404);
    const { book: bk, devices, pageStats } = out;
    const bookOut: BookDetail = {
      md5: bk.md5,
      title: bk.title,
      customTitle: bk.customTitle,
      authors: bk.authors,
      series: bk.series,
      language: bk.language,
      isbn: bk.isbn,
      hidden: bk.hidden,
      completedAt: bk.completedAt,
      coverPath: bk.coverPath,
      coverSource: bk.coverSource,
      createdAt: bk.createdAt.toISOString(),
      displayTitle: bk.displayTitle,
      coverUrl: bk.coverPath ? `/api/books/${bk.md5}/cover` : null,
    };
    return c.json({
      book: bookOut,
      devices,
      pageStats,
    });
  });

  r.put(
    '/:md5',
    requireAdmin,
    zValidator('json', updateBookBody),
    async (c) => {
      const md5 = c.req.param('md5');
      const {
        completed,
        completedAt: completedAtOverride,
        ...rest
      } = c.req.valid('json');
      const result = await updateBook(db, md5, {
        ...rest,
        completed,
        completedAt: completedAtOverride,
      });
      if (!result.found) return c.json({ error: 'Not found' }, 404);
      if (result.isbnChanged) {
        await autoCoverAfterIsbnChange(
          db,
          cfg,
          md5,
          result.hadManualCover,
          result.nextIsbn,
        );
      }
      return c.json({ ok: true });
    },
  );

  return r;
}
