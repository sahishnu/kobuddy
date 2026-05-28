/** Calendar year for an instant in an IANA timezone (matches stats dashboard semantics). */
export function localCalendarYear(
  timeZone: string,
  nowMs = Date.now(),
): number {
  return Number.parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
    }).format(new Date(nowMs)),
    10,
  );
}
