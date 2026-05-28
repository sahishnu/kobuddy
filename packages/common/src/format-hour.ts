/** Hour of day (0–23) as compact 12-hour clock, e.g. 0 → "12am", 14 → "2pm". */
export function formatHour12(hour: number): string {
  const period = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 || 12;
  return `${hour12}${period}`;
}

/** Inclusive start hour to next hour, e.g. 22 → "10pm–11pm", 23 → "11pm–12am". */
export function formatHourRange12(startHour: number): string {
  const endHour = (startHour + 1) % 24;
  return `${formatHour12(startHour)}–${formatHour12(endHour)}`;
}
