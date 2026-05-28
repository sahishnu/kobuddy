import type { CurrentReadingBook, StatsOverview } from '@kobuddy/common';
import {
  type CurrentReadingBookRow,
  currentReadingBook,
} from '../books/index.js';
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
import type { PageStatForDashboard } from './stats-dashboard.js';
import {
  booksFinishedInLocalYear,
  calendarByDayInZone,
  hourlyReadingProfile,
  pagesReadThisIsoWeek,
  streaksFromCalendarDays,
  weekDailyReading,
} from './stats-dashboard.js';
import {
  completedBooksVisible,
  loadVisiblePageStats,
  totalPagesRead,
  visibleBookAuthorCounts,
} from './stats-queries.js';

export type OverviewBuildInput = {
  stats: PageStatForDashboard[];
  totalPagesRead: number;
  bookAuthor: { totalBooks: number; authorValues: (string | null)[] };
  completedBooks: { md5: string; completedAt: number }[];
  currentRow: CurrentReadingBookRow | null;
};

export async function loadOverviewBuildInput(
  db: DbClient,
): Promise<OverviewBuildInput> {
  const [stats, totalPagesReadCount, bookAuthor, completedBooks, currentRow] =
    await Promise.all([
      loadVisiblePageStats(db),
      totalPagesRead(db),
      visibleBookAuthorCounts(db),
      completedBooksVisible(db),
      currentReadingBook(db),
    ]);
  return {
    stats,
    totalPagesRead: totalPagesReadCount,
    bookAuthor,
    completedBooks,
    currentRow,
  };
}

function currentBookFromRow(row: CurrentReadingBookRow): CurrentReadingBook {
  return {
    md5: row.md5,
    displayTitle: row.displayTitle,
    authors: row.authors,
    pages: row.pages,
    totalReadPages: row.totalReadPages,
    lastOpen: row.lastOpen,
    coverUrl: row.coverPath ? `/api/books/${row.md5}/cover` : null,
  };
}

/**
 * Assemble `StatsOverview` from loaded rows. All civil-calendar fields use `timeZone` and `nowMs`.
 */
export function buildStatsOverview(
  input: OverviewBuildInput,
  cfg: AppConfig,
  timeZone: string,
  nowMs: number,
): StatsOverview {
  const {
    stats,
    totalPagesRead: pages,
    bookAuthor,
    completedBooks,
    currentRow,
  } = input;

  const calendar = calendarByDayInZone(stats, timeZone);
  const streaks = streaksFromCalendarDays(calendar, nowMs, timeZone);
  const hourly = hourlyReadingProfile(stats, timeZone);
  const localYear = Number.parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
    }).format(new Date(nowMs)),
    10,
  );

  return {
    totalReadingTimeSeconds: totalReadingTime(stats),
    totalPagesRead: pages,
    totalBooks: bookAuthor.totalBooks,
    totalAuthors: countUniqueAuthorTokens(bookAuthor.authorValues),
    perMonth: getPerMonthReadingTime(stats, timeZone),
    perDayOfTheWeek: perDayOfTheWeek(stats, timeZone),
    mostPagesInADay: mostPagesInADay(stats, timeZone),
    longestDaySeconds: longestDay(stats, timeZone),
    last7DaysReadTimeSeconds: last7DaysReadTime(stats, timeZone, nowMs),
    calendar,
    statsTimeZone: timeZone,
    readingGoalBooksPerYear: cfg.READING_GOAL_BOOKS ?? null,
    booksFinishedThisLocalYear: booksFinishedInLocalYear(
      stats,
      localYear,
      timeZone,
      completedBooks,
    ),
    pagesReadThisIsoWeek: pagesReadThisIsoWeek(stats, nowMs, timeZone),
    weekDailyReading: weekDailyReading(stats, stats, nowMs, timeZone),
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
    currentBook: currentRow ? currentBookFromRow(currentRow) : null,
  };
}
