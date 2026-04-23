import { describe, expect, it } from 'vitest';
import {
  addGregorianDays,
  booksFinishedInLocalYear,
  hourlyReadingProfile,
  isoWeekKeyForGregorian,
  pagesReadThisIsoWeek,
  readingPersonaFromPeakHour,
  streaksFromCalendarDays,
} from './stats-dashboard.js';

describe('addGregorianDays', () => {
  it('steps backward across month boundary', () => {
    expect(addGregorianDays('2025-03-01', -1)).toBe('2025-02-28');
  });
});

describe('isoWeekKeyForGregorian', () => {
  it('matches known ISO week boundaries', () => {
    expect(isoWeekKeyForGregorian(2024, 12, 31)).toBe('2025-W01');
    expect(isoWeekKeyForGregorian(2025, 6, 15)).toBe('2025-W24');
  });
});

describe('pagesReadThisIsoWeek', () => {
  it('sums positive page deltas within the same ISO week', () => {
    const nowMs = Date.UTC(2025, 5, 18, 12, 0, 0);
    const rows = [
      {
        startTime: Math.floor(nowMs / 1000) - 100,
        duration: 60,
        totalPages: 200,
        bookMd5: 'a',
        page: 10,
        deviceId: 'd1',
      },
      {
        startTime: Math.floor(nowMs / 1000),
        duration: 60,
        totalPages: 200,
        bookMd5: 'a',
        page: 25,
        deviceId: 'd1',
      },
    ];
    expect(pagesReadThisIsoWeek(rows, nowMs, 'UTC')).toBe(15);
  });
});

describe('streaksFromCalendarDays', () => {
  it('counts current streak ending yesterday when today empty', () => {
    const nowMs = Date.UTC(2025, 5, 18, 12, 0, 0);
    const todayYmd = '2025-06-18';
    const d1 = addGregorianDays(todayYmd, -1);
    const d2 = addGregorianDays(todayYmd, -2);
    const streaks = streaksFromCalendarDays(
      [
        { date: d2, minutes: 30 },
        { date: d1, minutes: 20 },
      ],
      nowMs,
      'UTC',
    );
    expect(streaks.currentStreakDays).toBe(2);
    expect(streaks.longestStreakDays).toBe(2);
  });
});

describe('hourlyReadingProfile', () => {
  it('buckets minutes into local hours and averages by distinct reading days', () => {
    const day1 = Date.UTC(2025, 0, 1, 22, 30, 0) / 1000;
    const day2 = Date.UTC(2025, 0, 2, 22, 0, 0) / 1000;
    const stats = [
      {
        startTime: Math.floor(day1),
        duration: 3600,
        totalPages: 100,
        bookMd5: 'b',
      },
      {
        startTime: Math.floor(day2),
        duration: 1800,
        totalPages: 100,
        bookMd5: 'b',
      },
    ];
    const p = hourlyReadingProfile(stats, 'UTC');
    expect(p.averageMinutesByHour[22]).toBe(45);
    expect(p.peakHour).toBe(22);
  });
});

describe('booksFinishedInLocalYear', () => {
  it('counts distinct books with last-page session in year', () => {
    const t = Math.floor(Date.UTC(2025, 5, 1, 12, 0, 0) / 1000);
    const n = booksFinishedInLocalYear(
      [
        { startTime: t, page: 99, totalPages: 100, bookMd5: 'x' },
        { startTime: t, page: 99, totalPages: 100, bookMd5: 'y' },
        { startTime: t, page: 50, totalPages: 100, bookMd5: 'z' },
      ],
      2025,
      'UTC',
    );
    expect(n).toBe(2);
  });
});

describe('readingPersonaFromPeakHour', () => {
  it('labels late-night peaks', () => {
    const p = readingPersonaFromPeakHour(23);
    expect(p.label).toBe('Night owl');
  });
});
