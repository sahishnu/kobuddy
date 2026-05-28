import { zValidator } from '@hono/zod-validator';
import type { BookDetail, BookListItem, BookListPage } from '@kobuddy/common';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  ADMIN_BOOKS_DEFAULT_PAGE_SIZE,
  ADMIN_BOOKS_MAX_PAGE_SIZE,
  getBook,
  listBooks,
  listBooksPage,
  setBookHidden,
  updateBook,
} from '../books/index.js';
import type { AppConfig } from '../config.js';
import {
  applyAutoCoverForBook,
  applyCoverPolicyAfterBookUpdate,
  applyCustomCover,
  applyIsbnAutoForBook,
  coverCandidatesForBook,
  deleteCover,
  isbnCandidatesForBook,
  serveCoverBytesForBook,
} from '../covers/index.js';
import {
  ingestKoreaderSqliteFromMultipart,
  KoreaderSqliteMultipartError,
} from '../ingest/index.js';
import { afterStatsAffectingMutation } from '../lib/after-stats-affecting-mutation.js';
import type { DbClient } from '../lib/db.js';
import { bookCoverUrl } from '../lib/urls.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requirePublicReadOrAdmin } from '../middleware/require-public-or-admin.js';
import type { AppEnv } from '../middleware/session.js';

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
    const pageRaw = c.req.query('page');
    const pageParsed = pageRaw ? Number.parseInt(pageRaw, 10) : NaN;

    if (Number.isFinite(pageParsed) && pageParsed > 0) {
      const pageSizeRaw = c.req.query('pageSize');
      const pageSizeParsed = pageSizeRaw
        ? Number.parseInt(pageSizeRaw, 10)
        : NaN;
      const pageSize =
        Number.isFinite(pageSizeParsed) && pageSizeParsed > 0
          ? Math.min(ADMIN_BOOKS_MAX_PAGE_SIZE, pageSizeParsed)
          : ADMIN_BOOKS_DEFAULT_PAGE_SIZE;
      const search =
        c.req.query('q')?.trim() || c.req.query('search')?.trim() || undefined;
      const hiddenOnly = Boolean(
        session.isAdmin && c.req.query('hiddenOnly') === 'true',
      );
      const pageShowHidden =
        hiddenOnly ||
        Boolean(session.isAdmin && c.req.query('showHidden') === 'true');

      const result = await listBooksPage(db, {
        showHidden: pageShowHidden,
        hiddenOnly,
        sort: sort === 'lastOpen' ? 'lastOpen' : undefined,
        page: pageParsed,
        pageSize,
        search,
      });
      const body: BookListPage = {
        ...result,
        items: result.items.map((b) => ({
          ...b,
          coverUrl: bookCoverUrl(b.md5, b.coverPath),
        })),
      };
      return c.json(body);
    }

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
      coverUrl: bookCoverUrl(b.md5, b.coverPath),
    }));
    return c.json(list);
  });

  r.post('/import-sqlite', requireAdmin, async (c) => {
    try {
      const body = await c.req.parseBody({ all: true });
      const result = await afterStatsAffectingMutation(db, () =>
        ingestKoreaderSqliteFromMultipart(db, body),
      );
      return c.json({
        ok: true,
        message: 'Import successful',
        booksImported: result.booksImported,
        pageStatsImported: result.pageStatsImported,
        pageStatsFiltered: result.pageStatsFiltered,
      });
    } catch (e) {
      if (e instanceof KoreaderSqliteMultipartError) {
        return c.json({ error: e.message }, 400);
      }
      const msg = e instanceof Error ? e.message : 'Import failed';
      return c.json({ error: msg }, 400);
    }
  });

  // --- Cover endpoints ---

  r.get('/:md5/cover/candidates', requireAdmin, async (c) => {
    const md5 = c.req.param('md5');
    const result = await coverCandidatesForBook(db, cfg, md5, {
      query: c.req.query('q'),
    });
    if (!result.ok) return c.json({ error: 'Not found' }, 404);
    return c.json({ candidates: result.candidates });
  });

  r.post(
    '/:md5/cover/auto',
    requireAdmin,
    zValidator('json', coverAutoBody),
    async (c) => {
      const md5 = c.req.param('md5');
      const result = await afterStatsAffectingMutation(
        db,
        () => applyAutoCoverForBook(db, cfg, md5, c.req.valid('json')),
        { invalidate: (r) => r.ok },
      );
      if (!result.ok) {
        if (result.error === 'not_found')
          return c.json({ error: 'Not found' }, 404);
        if (result.error === 'no_cover')
          return c.json({ error: 'No cover found' }, 404);
        return c.json({ error: 'Download failed' }, 502);
      }
      return c.json({ ok: true, coverSource: result.coverSource });
    },
  );

  r.get('/:md5/cover', async (c) => {
    const md5 = c.req.param('md5');
    const result = await serveCoverBytesForBook(db, cfg, md5);
    if (!result.ok) return c.body(null, 404);
    return new Response(result.bytes, {
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
    await afterStatsAffectingMutation(db, () =>
      applyCustomCover(db, cfg, md5, buf),
    );
    return c.json({ ok: true });
  });

  r.delete('/:md5/cover', requireAdmin, async (c) => {
    const md5 = c.req.param('md5');
    await afterStatsAffectingMutation(db, () => deleteCover(db, cfg, md5));
    return c.json({ ok: true });
  });

  // --- ISBN endpoints ---

  r.get('/:md5/isbn/candidates', requireAdmin, async (c) => {
    const md5 = c.req.param('md5');
    const result = await isbnCandidatesForBook(db, cfg, md5, {
      query: c.req.query('q'),
    });
    if (!result.ok) return c.json({ error: 'Not found' }, 404);
    return c.json({ candidates: result.candidates });
  });

  r.post(
    '/:md5/isbn/auto',
    requireAdmin,
    zValidator('json', isbnAutoBody),
    async (c) => {
      const md5 = c.req.param('md5');
      const result = await afterStatsAffectingMutation(
        db,
        () => applyIsbnAutoForBook(db, cfg, md5, c.req.valid('json')),
        { invalidate: (r) => r.ok },
      );
      if (!result.ok) {
        if (result.error === 'not_found')
          return c.json({ error: 'Not found' }, 404);
        if (result.error === 'invalid_isbn')
          return c.json({ error: 'Invalid ISBN' }, 400);
        return c.json({ error: 'No ISBN found' }, 404);
      }
      return c.json({ ok: true, isbn: result.isbn });
    },
  );

  // --- Book CRUD ---

  r.put('/:md5/hide', requireAdmin, zValidator('json', hideBody), async (c) => {
    const md5 = c.req.param('md5');
    const { hidden } = c.req.valid('json');
    await afterStatsAffectingMutation(db, () => setBookHidden(db, md5, hidden));
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
      coverUrl: bookCoverUrl(bk.md5, bk.coverPath),
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
      const result = await afterStatsAffectingMutation(
        db,
        async () => {
          const result = await updateBook(db, md5, {
            ...rest,
            completed,
            completedAt: completedAtOverride,
          });
          if (!result.found) return result;
          await applyCoverPolicyAfterBookUpdate(db, cfg, md5, result);
          return result;
        },
        { invalidate: (r) => r.found },
      );
      if (!result.found) return c.json({ error: 'Not found' }, 404);
      return c.json({ ok: true });
    },
  );

  return r;
}
