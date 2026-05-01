import type {
  CurrentReadingBook,
  StatsByBook,
  StatsOverview,
} from '@kobuddy/common';
import { book, pageStat } from '@kobuddy/db/schema';
import { eq } from 'drizzle-orm';
import { currentReadingBook } from '../books/index.js';
import type { AppConfig } from '../config.js';
import type { DbClient } from '../lib/db.js';
import {
  countUniqueAuthorTokens,
  getPerMonthReadingTime,
  last7DaysReadTime,
  longestDay,
  mostPagesInADay,
  perDayOfTheWeek,
  totalReadingTime,
} from './aggregates.js';
import { getCachedJson, setCachedJson } from './stats-cache.js';
import {
  booksFinishedInLocalYear,
  calendarByDayInZone,
  hourlyReadingProfile,
  streaksFromCalendarDays,
  pagesReadThisIsoWeek as sumPagesReadThisIsoWeek,
  weekDailyReading,
} from './stats-dashboard.js';
import {
  completedBooksVisible,
  loadVisiblePageStats,
  totalPagesRead,
  visibleBookAuthorCounts,
} from './stats-queries.js';

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

  const [stats, pages, bookAuthor, completedBooks, currentRow] =
    await Promise.all([
      loadVisiblePageStats(db),
      totalPagesRead(db),
      visibleBookAuthorCounts(db),
      completedBooksVisible(db),
      currentReadingBook(db),
    ]);

  const currentBook: CurrentReadingBook | null = currentRow
    ? {
        md5: currentRow.md5,
        displayTitle: currentRow.displayTitle,
        authors: currentRow.authors,
        pages: currentRow.pages,
        totalReadPages: currentRow.totalReadPages,
        lastOpen: currentRow.lastOpen,
        coverUrl: currentRow.coverPath
          ? `/api/books/${currentRow.md5}/cover`
          : null,
      }
    : null;

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
  const pagesReadThisIsoWeek = sumPagesReadThisIsoWeek(stats, nowMs, timeZone);
  const weekDailyReadingResult = weekDailyReading(
    stats,
    stats,
    nowMs,
    timeZone,
  );

  const overview: StatsOverview = {
    totalReadingTimeSeconds: totalReadingTime(stats),
    totalPagesRead: pages,
    totalBooks: bookAuthor.totalBooks,
    totalAuthors: countUniqueAuthorTokens(bookAuthor.authorValues),
    perMonth: getPerMonthReadingTime(stats, timeZone),
    perDayOfTheWeek: perDayOfTheWeek(stats, timeZone),
    mostPagesInADay: mostPagesInADay(stats),
    longestDaySeconds: longestDay(stats),
    last7DaysReadTimeSeconds: last7DaysReadTime(stats),
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
