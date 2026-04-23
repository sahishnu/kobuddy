export type PerMonthReadingTime = {
  month: string;
  duration: number;
  date: Date;
};

export type PerDayOfTheWeek = {
  name: string;
  value: number;
  day: number;
};

export type CalendarDay = {
  date: string;
  minutes: number;
};

export type CurrentReadingBook = {
  md5: string;
  displayTitle: string;
  /** Raw author string from metadata, if any. */
  authors: string | null;
  coverUrl: string | null;
  pages: number;
  totalReadPages: number;
  lastOpen: number | null;
};

export type HourlyReadingBlock = {
  averageMinutesByHour: number[];
  peakHour: number;
  personaLabel: string;
  personaDetail: string;
};

export type StatsOverview = {
  totalReadingTimeSeconds: number;
  totalPagesRead: number;
  /** Visible (non-hidden) books in the library. */
  totalBooks: number;
  /** Distinct author names after splitting combined author fields. */
  totalAuthors: number;
  perMonth: PerMonthReadingTime[];
  perDayOfTheWeek: PerDayOfTheWeek[];
  mostPagesInADay: number;
  longestDaySeconds: number;
  last7DaysReadTimeSeconds: number;
  calendar: CalendarDay[];
  /** IANA timezone used for calendar, streaks, week, and hourly aggregates. */
  statsTimeZone: string;
  /** From env `READING_GOAL_BOOKS`; null if unset. */
  readingGoalBooksPerYear: number | null;
  /** Distinct books with a last-page session in the current local calendar year. */
  booksFinishedThisLocalYear: number;
  /** Sum of positive page deltas within the current ISO week (see server implementation). */
  pagesReadThisIsoWeek: number;
  currentStreakDays: number;
  longestStreakDays: number;
  hourlyReading: HourlyReadingBlock;
  currentBook: CurrentReadingBook | null;
};
