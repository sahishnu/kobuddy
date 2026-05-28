import { zValidator } from '@hono/zod-validator';
import {
  READING_GOAL_MAX_BOOKS,
  type ReadingGoalResponse,
} from '@kobuddy/common';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { afterStatsAffectingMutation } from '../lib/after-stats-affecting-mutation.js';
import type { DbClient } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requirePublicReadOrAdmin } from '../middleware/require-public-or-admin.js';
import type { AppEnv } from '../middleware/session.js';
import {
  clearReadingGoalForYear,
  getReadingGoalForYear,
  setReadingGoalForYear,
} from '../reading-goals/index.js';

const yearParam = z.coerce.number().int().min(1970).max(3000);

const setBody = z.object({
  books: z.number().int().positive().max(READING_GOAL_MAX_BOOKS).nullable(),
});

export function readingGoalsRouter(cfg: AppConfig, db: DbClient) {
  const r = new Hono<AppEnv>();

  r.get('/:year', requirePublicReadOrAdmin(cfg), async (c) => {
    const parsed = yearParam.safeParse(c.req.param('year'));
    if (!parsed.success) {
      return c.json({ error: 'Invalid year' }, 400);
    }
    const books = await getReadingGoalForYear(db, parsed.data);
    const body: ReadingGoalResponse = { year: parsed.data, books };
    return c.json(body);
  });

  r.put('/:year', requireAdmin, zValidator('json', setBody), async (c) => {
    const parsed = yearParam.safeParse(c.req.param('year'));
    if (!parsed.success) {
      return c.json({ error: 'Invalid year' }, 400);
    }
    const { books } = c.req.valid('json');
    const year = parsed.data;

    await afterStatsAffectingMutation(db, async () => {
      if (books == null) {
        await clearReadingGoalForYear(db, year);
      } else {
        await setReadingGoalForYear(db, year, books);
      }
    });

    const body: ReadingGoalResponse = { year, books };
    return c.json(body);
  });

  return r;
}
