import { Hono } from 'hono';
import type { AppConfig } from '../config.js';
import type { DbClient } from '../lib/db.js';
import { requirePublicReadOrAdmin } from '../middleware/require-public-or-admin.js';
import type { AppEnv } from '../middleware/session.js';
import {
  isValidIanaTimeZone,
  statsCalendar,
  statsForBook,
  statsOverview,
} from '../stats/index.js';

export function statsRouter(cfg: AppConfig, db: DbClient) {
  const r = new Hono<AppEnv>();

  r.get('/', requirePublicReadOrAdmin(cfg), async (c) => {
    const rawTz = c.req.query('timeZone') ?? c.req.query('tz');
    const timeZone = rawTz && isValidIanaTimeZone(rawTz) ? rawTz : 'UTC';
    const overview = await statsOverview(db, cfg, timeZone);
    return c.json(overview);
  });

  r.get('/calendar', requirePublicReadOrAdmin(cfg), async (c) => {
    const rawTz = c.req.query('timeZone') ?? c.req.query('tz');
    const timeZone = rawTz && isValidIanaTimeZone(rawTz) ? rawTz : 'UTC';
    return c.json(await statsCalendar(db, timeZone));
  });

  r.get('/:md5', requirePublicReadOrAdmin(cfg), async (c) => {
    const md5 = c.req.param('md5');
    const rawTz = c.req.query('timeZone') ?? c.req.query('tz');
    const timeZone = rawTz && isValidIanaTimeZone(rawTz) ? rawTz : 'UTC';
    const body = await statsForBook(db, md5, timeZone);
    if (!body) return c.json({ error: 'Not found' }, 404);
    return c.json(body);
  });

  return r;
}
