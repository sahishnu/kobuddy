/**
 * Format a duration given in **seconds** as a compact "Xh Ym" string.
 *
 * Examples: 90 → "1m", 3600 → "1h", 3660 → "1h 1m", 45 → "45s"
 *
 * @param includeSeconds – when `true`, values under 60s render as "Xs" instead of "0m".
 */
export function formatDuration(
  totalSeconds: number,
  { includeSeconds = false }: { includeSeconds?: boolean } = {},
): string {
  if (includeSeconds && totalSeconds < 60) {
    return `${Math.round(totalSeconds)}s`;
  }
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
