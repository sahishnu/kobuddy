import { zValidator } from '@hono/zod-validator';
import {
  LOADING_QUOTE_AUTHOR_MAX,
  LOADING_QUOTE_BOOK_MAX,
  LOADING_QUOTE_TEXT_MAX,
  type LoadingQuoteListResponse,
} from '@kobuddy/common';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import type { DbClient } from '../lib/db.js';
import {
  createLoadingQuote,
  deleteLoadingQuote,
  getRandomLoadingQuote,
  listLoadingQuotes,
  updateLoadingQuote,
} from '../loading-quotes/index.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requirePublicReadOrAdmin } from '../middleware/require-public-or-admin.js';
import type { AppEnv } from '../middleware/session.js';

const idParam = z.coerce.number().int().positive();

const quoteBody = z.object({
  text: z.string().trim().min(1).max(LOADING_QUOTE_TEXT_MAX),
  author: z.string().trim().min(1).max(LOADING_QUOTE_AUTHOR_MAX),
  book: z.string().trim().min(1).max(LOADING_QUOTE_BOOK_MAX),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999_999).optional(),
});

export function loadingQuotesRouter(cfg: AppConfig, db: DbClient) {
  const r = new Hono<AppEnv>();

  r.get('/random', requirePublicReadOrAdmin(cfg), async (c) => {
    const quote = await getRandomLoadingQuote(db);
    if (!quote) {
      return c.json({ error: 'No loading quotes configured' }, 404);
    }
    return c.json(quote);
  });

  r.get('/', requireAdmin, async (c) => {
    const items = await listLoadingQuotes(db);
    const body: LoadingQuoteListResponse = { items };
    return c.json(body);
  });

  r.post('/', requireAdmin, zValidator('json', quoteBody), async (c) => {
    const input = c.req.valid('json');
    const quote = await createLoadingQuote(db, input);
    return c.json(quote, 201);
  });

  r.put('/:id', requireAdmin, zValidator('json', quoteBody), async (c) => {
    const parsed = idParam.safeParse(c.req.param('id'));
    if (!parsed.success) {
      return c.json({ error: 'Invalid id' }, 400);
    }
    const input = c.req.valid('json');
    const quote = await updateLoadingQuote(db, parsed.data, input);
    if (!quote) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.json(quote);
  });

  r.delete('/:id', requireAdmin, async (c) => {
    const parsed = idParam.safeParse(c.req.param('id'));
    if (!parsed.success) {
      return c.json({ error: 'Invalid id' }, 400);
    }
    const ok = await deleteLoadingQuote(db, parsed.data);
    if (!ok) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.json({ ok: true });
  });

  return r;
}
