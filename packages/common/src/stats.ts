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

export type StatsOverview = {
  totalReadingTimeSeconds: number;
  totalPagesRead: number;
  perMonth: PerMonthReadingTime[];
  perDayOfTheWeek: PerDayOfTheWeek[];
  mostPagesInADay: number;
  longestDaySeconds: number;
  last7DaysReadTimeSeconds: number;
  calendar: CalendarDay[];
};
