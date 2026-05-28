import type { StatsByBook, StatsOverview } from '@kobuddy/common';
import { book, pageStat } from '@kobuddy/db/schema';
import { eq } from 'drizzle-orm';
import type { AppConfig } from '../config.js';
import type { DbClient } from '../lib/db.js';
import {
  getPerMonthReadingTime,
  perDayOfTheWeek,
  totalReadingTime,
} from './aggregates.js';
import {
  buildStatsOverview,
  loadOverviewBuildInput,
} from './build-overview.js';
import { getCachedJson, setCachedJson } from './stats-cache.js';
import { calendarByDayInZone } from './stats-dashboard.js';
import { loadVisiblePageStats } from './stats-queries.js';

export type { OverviewBuildInput } from './build-overview.js';
export {
  buildStatsOverview,
  loadOverviewBuildInput,
} from './build-overview.js';
export { invalidateStatsCache } from './stats-cache.js';
export { isValidIanaTimeZone } from './stats-tz.js';

export async function statsOverview(
  db: DbClient,
  cfg: AppConfig,
  timeZone: string,
): Promise<StatsOverview> {
  const cacheKey = `stats:overview:${timeZone}`;
  const cached = await getCachedJson<StatsOverview>(db, cacheKey);
  if (cached) return cached;

  const input = await loadOverviewBuildInput(db);
  const nowMs = Date.now();
  const overview = buildStatsOverview(input, cfg, timeZone, nowMs);

  await setCachedJson(db, cacheKey, overview);
  return overview;
}

export async function statsCalendar(db: DbClient, timeZone: string) {
  const stats = await loadVisiblePageStats(db);
  return { calendar: calendarByDayInZone(stats, timeZone) };
}

export async function statsForBook(
  db: DbClient,
  md5: string,
  timeZone: string,
): Promise<StatsByBook | null> {
  const [b] = await db
    .select({ hidden: book.hidden })
    .from(book)
    .where(eq(book.md5, md5))
    .limit(1);
  if (!b || b.hidden) return null;

  const rows = await db
    .select({
      startTime: pageStat.startTime,
      duration: pageStat.duration,
      totalPages: pageStat.totalPages,
      bookMd5: pageStat.bookMd5,
    })
    .from(pageStat)
    .where(eq(pageStat.bookMd5, md5));

  return {
    bookMd5: md5,
    totalReadingTimeSeconds: totalReadingTime(rows),
    perMonth: getPerMonthReadingTime(rows, timeZone),
    perDayOfTheWeek: perDayOfTheWeek(rows, timeZone),
    calendar: calendarByDayInZone(rows, timeZone),
    statsTimeZone: timeZone,
  };
}
