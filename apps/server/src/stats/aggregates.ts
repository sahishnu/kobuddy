import type { PerDayOfTheWeek, PerMonthReadingTime } from '@kobuddy/common';
import { groupBy, sum } from 'ramda';
import { addGregorianDays, localYmd, localYmdParts } from './stats-tz.js';

/** Page stats with `startTime` as Unix seconds (KOReader). */
export type StatRow = {
  startTime: number;
  duration: number;
  totalPages: number;
  bookMd5: string;
  page?: number;
  deviceId?: string;
};

function toMs(seconds: number): Date {
  return new Date(seconds * 1000);
}

function getPagesPerDay(stats: StatRow[], timeZone: string): number[] {
  const statsPerDay = groupBy(
    (stat: StatRow) => localYmd(stat.startTime, timeZone),
    stats,
  );

  return Object.values(statsPerDay).map((dayStats) => dayStats?.length ?? 0);
}

/**
 * Counts unique author names across books by splitting combined author strings
 * (commas, semicolons, ampersands, and the word "and").
 */
export function countUniqueAuthorTokens(
  authorValues: (string | null | undefined)[],
): number {
  const set = new Set<string>();
  for (const raw of authorValues) {
    if (raw == null || !String(raw).trim()) continue;
    const s = String(raw).trim();
    const segments = s
      .split(/(?:\s*,\s*|\s*;\s*|\s*&\s*|\s+and\s+)/i)
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
    if (segments.length === 0) continue;
    if (segments.length === 1) {
      const one = segments[0];
      if (one) set.add(one.toLowerCase());
    } else {
      for (const seg of segments) {
        set.add(seg.toLowerCase());
      }
    }
  }
  return set.size;
}

/** 0 = Sunday … 6 = Saturday for the civil calendar day in `timeZone`. */
function civilSunday0FromUnixInZone(
  unixSeconds: number,
  timeZone: string,
): number {
  const { y, m, d } = localYmdParts(unixSeconds, timeZone);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
}

const WEEKDAY_NAMES_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function getPerMonthReadingTime(
  stats: StatRow[],
  timeZone: string,
): PerMonthReadingTime[] {
  const monthFmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    year: 'numeric',
  });
  return (stats ?? [])
    .reduce<PerMonthReadingTime[]>((acc, stat) => {
      const d = toMs(stat.startTime);
      const month = monthFmt.format(d);
      const monthData = acc.find((item) => item.month === month);
      if (monthData) {
        monthData.duration += stat.duration;
      } else {
        acc.push({ month, duration: stat.duration, date: d });
      }
      return acc;
    }, [])
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function perDayOfTheWeek(
  stats: StatRow[],
  timeZone: string,
): PerDayOfTheWeek[] {
  const byDow = new Map<number, number>();
  for (const stat of stats) {
    const dow = civilSunday0FromUnixInZone(stat.startTime, timeZone);
    byDow.set(dow, (byDow.get(dow) ?? 0) + stat.duration);
  }
  return [...byDow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, value]) => ({
      name: WEEKDAY_NAMES_EN[day] ?? WEEKDAY_NAMES_EN[0],
      value,
      day,
    }));
}

export function mostPagesInADay(stats: StatRow[], timeZone: string): number {
  const max = Math.round(Math.max(...getPagesPerDay(stats, timeZone), 0));
  return Math.max(0, max);
}

export function totalReadingTime(stats: StatRow[]): number {
  return sum((stats ?? []).map((s) => s.duration));
}

export function longestDay(stats: StatRow[], timeZone: string): number {
  const timePerDay = new Map<string, number>();
  for (const stat of stats) {
    const key = localYmd(stat.startTime, timeZone);
    timePerDay.set(key, (timePerDay.get(key) ?? 0) + stat.duration);
  }
  const values = [...timePerDay.values()];
  if (values.length === 0) return 0;
  return Math.max(0, Math.max(...values));
}

/** Sum reading time on the last 7 civil calendar days in `timeZone` (today inclusive). */
export function last7DaysReadTime(
  stats: StatRow[],
  timeZone: string,
  nowMs: number = Date.now(),
): number {
  const todayYmd = localYmd(Math.floor(nowMs / 1000), timeZone);
  const oldestYmd = addGregorianDays(todayYmd, -6);
  let total = 0;
  for (const stat of stats) {
    const ymd = localYmd(stat.startTime, timeZone);
    if (ymd >= oldestYmd && ymd <= todayYmd) {
      total += stat.duration;
    }
  }
  return total;
}
