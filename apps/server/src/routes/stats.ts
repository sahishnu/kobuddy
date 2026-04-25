import type { StatsOverview } from '@kobuddy/common';
import { book, pageStat } from '@kobuddy/db/schema';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AppConfig } from '../config.js';
import type { DbClient } from '../lib/db.js';
import { displayTitle } from '../lib/display.js';
import { requirePublicReadOrAdmin } from '../middleware/require-public-or-admin.js';
import type { AppEnv } from '../middleware/session.js';
import {
  loadBookDeviceAggregates,
  pickCurrentReadingBookMd5,
} from '../stats/book-device-aggregates.js';
import { getCachedJson, setCachedJson } from '../stats/stats-cache.js';
import {
  booksFinishedInLocalYear,
  calendarByDayInZone,
  hourlyReadingProfile,
  streaksFromCalendarDays,
  pagesReadThisIsoWeek as sumPagesReadThisIsoWeek,
  weekDailyReading,
} from '../stats/stats-dashboard.js';
import {
  completedBooksVisible,
  loadVisiblePageStats,
  totalPagesRead,
  visibleBookAuthorCounts,
} from '../stats/stats-queries.js';
import {
  countUniqueAuthorTokens,
  statsService,
} from '../stats/stats-service.js';
import { isValidIanaTimeZone } from '../stats/stats-tz.js';

export function statsRouter(cfg: AppConfig, db: DbClient) {
  const r = new Hono<AppEnv>();

  async function loadCurrentReadingBook() {
    const rows = await loadBookDeviceAggregates(db);
    const topMd5 = pickCurrentReadingBookMd5(rows);
    if (!topMd5) return null;
    const top = rows.find((r) => r.bookMd5 === topMd5);
    if (!top) return null;

    const [b] = await db
      .select()
      .from(book)
      .where(eq(book.md5, topMd5))
      .limit(1);
    if (!b) return null;

    const authors = b.authors?.trim() || null;
    return {
      md5: b.md5,
      displayTitle: displayTitle(b),
      authors,
      coverUrl: b.coverPath ? `/api/books/${b.md5}/cover` : null,
      pages: top.maxPages ?? 0,
      totalReadPages: top.maxRead ?? 0,
      lastOpen: top.maxLastOpen > 0 ? top.maxLastOpen : null,
    };
  }

  r.get('/', requirePublicReadOrAdmin(cfg), async (c) => {
    const rawTz = c.req.query('timeZone') ?? c.req.query('tz');
    const timeZone = rawTz && isValidIanaTimeZone(rawTz) ? rawTz : 'UTC';

    const cacheKey = `stats:overview:${timeZone}`;
    const cached = await getCachedJson<StatsOverview>(db, cacheKey);
    if (cached) return c.json(cached);

    const [stats, pages, bookAuthor, completedBooks, currentBook] =
      await Promise.all([
        loadVisiblePageStats(db),
        totalPagesRead(db),
        visibleBookAuthorCounts(db),
        completedBooksVisible(db),
        loadCurrentReadingBook(),
      ]);

    const nowMs = Date.now();
    const calendar = calendarByDayInZone(stats, timeZone);
    const streaks = streaksFromCalendarDays(calendar, nowMs, timeZone);
    const hourly = hourlyReadingProfile(stats, timeZone);
    const year = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
    }).format(new Date(nowMs));

    const booksFinishedThisLocalYear = booksFinishedInLocalYear(
      stats,
      Number.parseInt(year, 10),
      timeZone,
      completedBooks,
    );
    const pagesReadThisIsoWeek = sumPagesReadThisIsoWeek(
      stats,
      nowMs,
      timeZone,
    );
    const weekDailyReadingResult = weekDailyReading(
      stats,
      stats,
      nowMs,
      timeZone,
    );

    const overview: StatsOverview = {
      totalReadingTimeSeconds: statsService.totalReadingTime(stats),
      totalPagesRead: pages,
      totalBooks: bookAuthor.totalBooks,
      totalAuthors: countUniqueAuthorTokens(bookAuthor.authorValues),
      perMonth: statsService.getPerMonthReadingTime(stats),
      perDayOfTheWeek: statsService.perDayOfTheWeek(stats),
      mostPagesInADay: statsService.mostPagesInADay(stats),
      longestDaySeconds: statsService.longestDay(stats),
      last7DaysReadTimeSeconds: statsService.last7DaysReadTime(stats),
      calendar,
      statsTimeZone: timeZone,
      readingGoalBooksPerYear: cfg.READING_GOAL_BOOKS ?? null,
      booksFinishedThisLocalYear,
      pagesReadThisIsoWeek,
      weekDailyReading: weekDailyReadingResult,
      currentStreakDays: streaks.currentStreakDays,
      longestStreakDays: streaks.longestStreakDays,
      longestStreakStart: streaks.longestStreakStart,
      longestStreakEnd: streaks.longestStreakEnd,
      hourlyReading: {
        averageMinutesByHour: hourly.averageMinutesByHour,
        peakHour: hourly.peakHour,
        personaLabel: hourly.personaLabel,
        personaDetail: hourly.personaDetail,
      },
      currentBook,
    };

    await setCachedJson(db, cacheKey, overview);
    return c.json(overview);
  });

  r.get('/calendar', requirePublicReadOrAdmin(cfg), async (c) => {
    const rawTz = c.req.query('timeZone') ?? c.req.query('tz');
    const timeZone = rawTz && isValidIanaTimeZone(rawTz) ? rawTz : 'UTC';
    const stats = await loadVisiblePageStats(db);
    return c.json({ calendar: calendarByDayInZone(stats, timeZone) });
  });

  r.get('/:md5', requirePublicReadOrAdmin(cfg), async (c) => {
    const md5 = c.req.param('md5');
    const rawTz = c.req.query('timeZone') ?? c.req.query('tz');
    const timeZone = rawTz && isValidIanaTimeZone(rawTz) ? rawTz : 'UTC';
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
      calendar: calendarByDayInZone(rows, timeZone),
    });
  });

  return r;
}
