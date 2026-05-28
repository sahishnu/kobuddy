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

export type WeekDayReading = {
  /** ISO day of week: 1=Mon … 7=Sun */
  dow: number;
  label: string;
  pages: number;
  minutes: number;
};

/** Per-book reading stats for `GET /api/stats/:md5` (visible books only). */
export type StatsByBook = {
  bookMd5: string;
  totalReadingTimeSeconds: number;
  perMonth: PerMonthReadingTime[];
  perDayOfTheWeek: PerDayOfTheWeek[];
  calendar: CalendarDay[];
  /** IANA timezone used for per-month, weekday, and calendar fields. */
  statsTimeZone: string;
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
  /** Admin-set books target for the current local calendar year; null if unset. */
  readingGoalBooksPerYear: number | null;
  /** Distinct books with a last-page session in the current local calendar year. */
  booksFinishedThisLocalYear: number;
  /** Sum of positive page deltas within the current ISO week (see server implementation). */
  pagesReadThisIsoWeek: number;
  weekDailyReading: WeekDayReading[];
  currentStreakDays: number;
  longestStreakDays: number;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
  hourlyReading: HourlyReadingBlock;
  currentBook: CurrentReadingBook | null;
};
