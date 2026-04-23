import type { CalendarDay } from '@kobuddy/common';
import type { StatRow } from './stats-service.js';
import {
  isoWeekYearAndWeek,
  localHour,
  localIsoWeekKey,
  localYear,
  localYmd,
  localYmdParts,
} from './stats-tz.js';

/** Add calendar days to a `yyyy-MM-dd` string (civil Gregorian). */
export function addGregorianDays(ymd: string, delta: number): string {
  const parts = ymd.split('-').map(Number);
  const yy = parts[0] ?? 0;
  const mm = parts[1] ?? 0;
  const dd = parts[2] ?? 0;
  const t = new Date(Date.UTC(yy, mm - 1, dd + delta, 12, 0, 0));
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, '0');
  const d = String(t.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type PageStatForDashboard = StatRow & {
  page: number;
  deviceId: string;
};

/** Sum of positive page deltas within the same ISO week as "now" in `timeZone`, capped per step by `total_pages`. */
export function pagesReadThisIsoWeek(
  rows: PageStatForDashboard[],
  nowMs: number,
  timeZone: string,
): number {
  const nowKey = localIsoWeekKey(Math.floor(nowMs / 1000), timeZone);
  const inWeek = rows.filter(
    (r) => localIsoWeekKey(r.startTime, timeZone) === nowKey,
  );
  const byKey = new Map<string, PageStatForDashboard[]>();
  for (const r of inWeek) {
    const k = `${r.bookMd5}\0${r.deviceId}`;
    let arr = byKey.get(k);
    if (!arr) {
      arr = [];
      byKey.set(k, arr);
    }
    arr.push(r);
  }
  let total = 0;
  for (const arr of byKey.values()) {
    arr.sort((a, b) => a.startTime - b.startTime);
    const first = arr[0];
    if (!first) continue;
    let prev = first.page;
    for (let i = 1; i < arr.length; i++) {
      const cur = arr[i];
      if (!cur) continue;
      const delta = cur.page - prev;
      if (delta > 0) {
        const cap = cur.totalPages > 0 ? cur.totalPages : 10_000;
        total += Math.min(delta, cap);
      }
      prev = cur.page;
    }
  }
  return Math.round(total);
}

export function calendarByDayInZone(
  stats: StatRow[],
  timeZone: string,
): CalendarDay[] {
  const map = new Map<string, number>();
  for (const s of stats) {
    const key = localYmd(s.startTime, timeZone);
    map.set(key, (map.get(key) ?? 0) + Math.round(s.duration / 60));
  }
  return [...map.entries()]
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type StreakResult = {
  currentStreakDays: number;
  longestStreakDays: number;
};

/**
 * Current streak: consecutive local days with reading > 0, anchored to today if today has
 * minutes, otherwise to yesterday (GitHub-style). Longest: max run over all days in `calendar`.
 */
export function streaksFromCalendarDays(
  calendar: CalendarDay[],
  nowMs: number,
  timeZone: string,
): StreakResult {
  const byDate = new Map(calendar.map((c) => [c.date, c.minutes] as const));
  const todayYmd = localYmd(Math.floor(nowMs / 1000), timeZone);
  const { y, m, d } = localYmdParts(Math.floor(nowMs / 1000), timeZone);
  const prev = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
  const yesterdayYmd = localYmd(Math.floor(prev.getTime() / 1000), timeZone);

  const todayMin = byDate.get(todayYmd) ?? 0;
  const anchorYmd = todayMin > 0 ? todayYmd : yesterdayYmd;

  function countStreakBack(fromYmd: string): number {
    let n = 0;
    let cur = fromYmd;
    while ((byDate.get(cur) ?? 0) > 0) {
      n++;
      cur = addGregorianDays(cur, -1);
    }
    return n;
  }

  let longest = 0;
  const sortedDates = [...byDate.keys()].sort();
  let run = 0;
  let prevDay: string | null = null;
  for (const date of sortedDates) {
    const mins = byDate.get(date) ?? 0;
    if (mins <= 0) {
      longest = Math.max(longest, run);
      run = 0;
      prevDay = null;
      continue;
    }
    if (prevDay) {
      const next = addGregorianDays(prevDay, 1);
      run = next === date ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prevDay = date;
  }
  longest = Math.max(longest, run);

  const currentStreakDays =
    (byDate.get(anchorYmd) ?? 0) > 0 ? countStreakBack(anchorYmd) : 0;

  return { currentStreakDays, longestStreakDays: longest };
}

export type HourlyReadingProfile = {
  averageMinutesByHour: number[];
  peakHour: number;
  personaLabel: string;
  personaDetail: string;
};

function formatHour12(h: number): string {
  const p = h >= 12 ? 'pm' : 'am';
  const x = h % 12 || 12;
  return `${x}${p}`;
}

export function readingPersonaFromPeakHour(peakHour: number): {
  label: string;
  detail: string;
} {
  const range = `${formatHour12(peakHour)}–${formatHour12((peakHour + 1) % 24)}`;
  if (peakHour >= 22 || peakHour <= 3) {
    return {
      label: 'Night owl',
      detail: `Most reading around ${range}.`,
    };
  }
  if (peakHour >= 5 && peakHour <= 9) {
    return {
      label: 'Early bird',
      detail: `Most reading around ${range}.`,
    };
  }
  if (peakHour >= 12 && peakHour <= 16) {
    return {
      label: 'Afternoon reader',
      detail: `Most reading around ${range}.`,
    };
  }
  return {
    label: 'Flexible reader',
    detail: `Peak hour ${range}.`,
  };
}

/** Total minutes per local hour; averages by number of distinct local days with any reading. */
export function hourlyReadingProfile(
  stats: StatRow[],
  timeZone: string,
): HourlyReadingProfile {
  const sumMin = new Array(24).fill(0);
  const daysWithReading = new Set<string>();

  for (const s of stats) {
    const day = localYmd(s.startTime, timeZone);
    const h = localHour(s.startTime, timeZone);
    const mins = s.duration / 60;
    if (mins > 0) daysWithReading.add(day);
    sumMin[h] = (sumMin[h] ?? 0) + mins;
  }

  const denom = Math.max(1, daysWithReading.size);
  const averageMinutesByHour = sumMin.map((x) =>
    Math.round((x as number) / denom),
  );

  let peakHour = 0;
  for (let h = 1; h < 24; h++) {
    const cur = averageMinutesByHour[h] ?? 0;
    const best = averageMinutesByHour[peakHour] ?? 0;
    if (cur > best) {
      peakHour = h;
    }
  }
  const { label, detail } = readingPersonaFromPeakHour(peakHour);
  return {
    averageMinutesByHour,
    peakHour,
    personaLabel: label,
    personaDetail: detail,
  };
}

export function booksFinishedInLocalYear(
  rows: {
    startTime: number;
    page: number;
    totalPages: number;
    bookMd5: string;
  }[],
  year: number,
  timeZone: string,
): number {
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.totalPages <= 0) continue;
    if (r.page < r.totalPages - 1) continue;
    if (localYear(r.startTime, timeZone) !== year) continue;
    seen.add(r.bookMd5);
  }
  return seen.size;
}

/** ISO week key for a civil y/m/d in that same calendar (used for tests). */
export function isoWeekKeyForGregorian(
  y: number,
  m: number,
  d: number,
): string {
  const { weekYear, week } = isoWeekYearAndWeek(y, m, d);
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}
