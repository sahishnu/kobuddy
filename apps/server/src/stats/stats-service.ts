import type {
  CalendarDay,
  PerDayOfTheWeek,
  PerMonthReadingTime,
} from '@kobuddy/common';
import { format, startOfDay, subDays } from 'date-fns';
import { groupBy, sum } from 'ramda';

/** Page stats with `startTime` as Unix seconds (KOReader). */
export type StatRow = {
  startTime: number;
  duration: number;
  totalPages: number;
  bookMd5: string;
};

export type BookRow = {
  md5: string;
  totalReadPages: number;
};

function toMs(seconds: number): Date {
  return new Date(seconds * 1000);
}

function getPagesPerDay(stats: StatRow[]): number[] {
  const statsPerDay = groupBy((stat: StatRow) =>
    startOfDay(toMs(stat.startTime)).getTime().toString(),
  )(stats);

  return Object.values(statsPerDay).map(
    (dayStats) => dayStats?.reduce((acc) => acc + 1, 0) ?? 0,
  );
}

export const statsService = {
  getPerMonthReadingTime(stats: StatRow[]): PerMonthReadingTime[] {
    return (stats ?? [])
      .reduce<PerMonthReadingTime[]>((acc, stat) => {
        const d = toMs(stat.startTime);
        const month = format(d, 'MMMM yyyy');
        const monthData = acc.find((item) => item.month === month);
        if (monthData) {
          monthData.duration += stat.duration;
        } else {
          acc.push({ month, duration: stat.duration, date: d });
        }
        return acc;
      }, [])
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  },

  perDayOfTheWeek(stats: StatRow[]): PerDayOfTheWeek[] {
    return stats
      .reduce<PerDayOfTheWeek[]>((acc, stat) => {
        const d = toMs(stat.startTime);
        const day = format(d, 'EEEE');
        const existingDay = acc.find((x) => x.name === day);
        if (existingDay) {
          existingDay.value += stat.duration;
        } else {
          acc.push({
            name: day,
            value: stat.duration,
            day: d.getUTCDay(),
          });
        }
        return acc;
      }, [])
      .sort((a, b) => a.day - b.day);
  },

  mostPagesInADay(stats: StatRow[]): number {
    const max = Math.round(Math.max(...getPagesPerDay(stats), 0));
    return Math.max(0, max);
  },

  totalReadingTime(stats: StatRow[]): number {
    return sum((stats ?? []).map((s) => s.duration));
  },

  longestDay(stats: StatRow[]): number {
    const timePerDay = stats.reduce<Record<number, number>>((acc, stat) => {
      const day = startOfDay(toMs(stat.startTime)).getTime();
      acc[day] = (acc[day] || 0) + stat.duration;
      return acc;
    }, {});
    const values = Object.values(timePerDay);
    if (values.length === 0) return 0;
    return Math.max(0, Math.max(...values));
  },

  last7DaysReadTime(stats: StatRow[]): number {
    const sevenDaysAgo = subDays(new Date(), 7);
    const lastSevenDays = stats.filter(
      (stat) => toMs(stat.startTime) > sevenDaysAgo,
    );
    return sum(lastSevenDays.map((s) => s.duration));
  },

  totalPagesRead(books: BookRow[]): number {
    return books.reduce((acc, b) => acc + (b.totalReadPages ?? 0), 0);
  },

  calendarByDay(stats: StatRow[]): CalendarDay[] {
    const map = new Map<string, number>();
    for (const s of stats) {
      const key = format(startOfDay(toMs(s.startTime)), 'yyyy-MM-dd');
      map.set(key, (map.get(key) ?? 0) + Math.round(s.duration / 60));
    }
    return [...map.entries()]
      .map(([date, minutes]) => ({ date, minutes }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
};
