import type { StatsOverview } from '@kobuddy/common';
import { book, bookDevice, pageStat } from '@kobuddy/db/schema';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { IronSession } from 'iron-session';
import type { AppConfig } from '../config.js';
import type { DbClient } from '../lib/db.js';
import { requirePublicReadOrAdmin } from '../middleware/require-public-or-admin.js';
import type { SessionData } from '../middleware/session.js';
import {
  loadBookDeviceAggregates,
  pickCurrentReadingBookMd5,
} from '../stats/book-device-aggregates.js';
import {
  booksFinishedInLocalYear,
  calendarByDayInZone,
  hourlyReadingProfile,
  streaksFromCalendarDays,
  pagesReadThisIsoWeek as sumPagesReadThisIsoWeek,
  weekDailyReading,
} from '../stats/stats-dashboard.js';
import {
  countUniqueAuthorTokens,
  statsService,
} from '../stats/stats-service.js';
import { isValidIanaTimeZone } from '../stats/stats-tz.js';

function displayTitle(b: { customTitle: string | null; title: string | null }) {
  return b.customTitle || b.title || '(untitled)';
}

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
        page: pageStat.page,
        deviceId: pageStat.deviceId,
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

  async function visibleBookAuthorTotals(): Promise<{
    totalBooks: number;
    totalAuthors: number;
  }> {
    const rows = await db
      .select({ authors: book.authors })
      .from(book)
      .where(eq(book.hidden, false));
    return {
      totalBooks: rows.length,
      totalAuthors: countUniqueAuthorTokens(rows.map((x) => x.authors)),
    };
  }

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

    const stats = await loadVisibleStats();
    const totalPages = await totalPagesRead();
    const { totalBooks, totalAuthors } = await visibleBookAuthorTotals();
    const nowMs = Date.now();
    const calendar = calendarByDayInZone(stats, timeZone);
    const streaks = streaksFromCalendarDays(calendar, nowMs, timeZone);
    const hourly = hourlyReadingProfile(stats, timeZone);
    const year = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
    }).format(new Date(nowMs));
    const completedBooks = await db
      .select({ md5: book.md5, completedAt: book.completedAt })
      .from(book)
      .where(and(eq(book.hidden, false), isNotNull(book.completedAt)));

    const booksFinishedThisLocalYear = booksFinishedInLocalYear(
      stats,
      Number.parseInt(year, 10),
      timeZone,
      completedBooks as { md5: string; completedAt: number }[],
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
    const currentBook = await loadCurrentReadingBook();

    const overview: StatsOverview = {
      totalReadingTimeSeconds: statsService.totalReadingTime(stats),
      totalPagesRead: totalPages,
      totalBooks,
      totalAuthors,
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
