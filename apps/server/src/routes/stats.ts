import { book, bookDevice, pageStat } from '@kobuddy/db/schema';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { IronSession } from 'iron-session';
import type { AppConfig } from '../config.js';
import type { DbClient } from '../lib/db.js';
import { requirePublicReadOrAdmin } from '../middleware/require-public-or-admin.js';
import type { SessionData } from '../middleware/session.js';
import { statsService } from '../stats/stats-service.js';

export function statsRouter(cfg: AppConfig, db: DbClient) {
  const r = new Hono<{
    Variables: { session: IronSession<SessionData> };
  }>();

  async function loadVisibleStats() {
    const rows = await db
      .select({
        startTime: pageStat.startTime,
        duration: pageStat.duration,
        totalPages: pageStat.totalPages,
        bookMd5: pageStat.bookMd5,
      })
      .from(pageStat)
      .innerJoin(book, eq(book.md5, pageStat.bookMd5))
      .where(eq(book.hidden, false));
    return rows;
  }

  async function totalPagesRead(): Promise<number> {
    const rows = await db
      .select({
        bookMd5: bookDevice.bookMd5,
        mx: sql<number>`max(${bookDevice.totalReadPages})`.mapWith(Number),
      })
      .from(bookDevice)
      .innerJoin(book, eq(book.md5, bookDevice.bookMd5))
      .where(eq(book.hidden, false))
      .groupBy(bookDevice.bookMd5);
    return rows.reduce((acc, row) => acc + (row.mx ?? 0), 0);
  }

  r.get('/', requirePublicReadOrAdmin(cfg), async (c) => {
    const stats = await loadVisibleStats();
    const totalPages = await totalPagesRead();
    const overview = {
      totalReadingTimeSeconds: statsService.totalReadingTime(stats),
      totalPagesRead: totalPages,
      perMonth: statsService.getPerMonthReadingTime(stats),
      perDayOfTheWeek: statsService.perDayOfTheWeek(stats),
      mostPagesInADay: statsService.mostPagesInADay(stats),
      longestDaySeconds: statsService.longestDay(stats),
      last7DaysReadTimeSeconds: statsService.last7DaysReadTime(stats),
      calendar: statsService.calendarByDay(stats),
    };
    return c.json(overview);
  });

  r.get('/calendar', requirePublicReadOrAdmin(cfg), async (c) => {
    const stats = await loadVisibleStats();
    return c.json({ calendar: statsService.calendarByDay(stats) });
  });

  r.get('/:md5', requirePublicReadOrAdmin(cfg), async (c) => {
    const md5 = c.req.param('md5');
    const rows = await db
      .select({
        startTime: pageStat.startTime,
        duration: pageStat.duration,
        totalPages: pageStat.totalPages,
        bookMd5: pageStat.bookMd5,
      })
      .from(pageStat)
      .where(eq(pageStat.bookMd5, md5));
    return c.json({
      bookMd5: md5,
      totalReadingTimeSeconds: statsService.totalReadingTime(rows),
      perMonth: statsService.getPerMonthReadingTime(rows),
      perDayOfTheWeek: statsService.perDayOfTheWeek(rows),
      calendar: statsService.calendarByDay(rows),
    });
  });

  return r;
}
