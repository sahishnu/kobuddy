/** Helpers for interpreting KOReader unix timestamps in an IANA timezone. */

export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

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

export function localYmd(unixSeconds: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(unixSeconds * 1000));
}

export function localYear(unixSeconds: number, timeZone: string): number {
  const y = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
  }).format(new Date(unixSeconds * 1000));
  return Number.parseInt(y, 10);
}

export function localHour(unixSeconds: number, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  }).format(new Date(unixSeconds * 1000));
  return Number.parseInt(h, 10);
}

/** Gregorian calendar date in `timeZone` at `unixSeconds`. */
export function localYmdParts(
  unixSeconds: number,
  timeZone: string,
): { y: number; m: number; d: number } {
  const d = new Date(unixSeconds * 1000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    y: Number.parseInt(map.year ?? '0', 10),
    m: Number.parseInt(map.month ?? '0', 10),
    d: Number.parseInt(map.day ?? '0', 10),
  };
}

/**
 * ISO week-year and week number (1–53) for a Gregorian calendar date (pure UTC math;
 * independent of server process timezone).
 */
export function isoWeekYearAndWeek(
  y: number,
  m: number,
  d: number,
): { weekYear: number; week: number } {
  let t = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = t.getUTCDay();
  const isoDow = dow === 0 ? 7 : dow;
  t = new Date(t.getTime() + (4 - isoDow) * 86400000);
  const weekYear = t.getUTCFullYear();
  const jan4 = new Date(Date.UTC(weekYear, 0, 4, 12, 0, 0));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4.getTime() - (jan4Dow - 1) * 86400000);
  const monThisWeek = new Date(t.getTime() - 3 * 86400000);
  const week =
    Math.round((monThisWeek.getTime() - week1Mon.getTime()) / (7 * 86400000)) +
    1;
  return { weekYear, week };
}

export function localIsoWeekKey(unixSeconds: number, timeZone: string): string {
  const { y, m, d } = localYmdParts(unixSeconds, timeZone);
  const { weekYear, week } = isoWeekYearAndWeek(y, m, d);
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}
