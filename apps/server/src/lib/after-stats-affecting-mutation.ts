import { invalidateStatsCache } from '../stats/index.js';
import type { DbClient } from './db.js';

/**
 * Run work that changes data used by `StatsOverview`, then clear the stats cache.
 * Ingest and domain modules stay cache-agnostic; routes (and scripts) use this at the composition root.
 */
export async function afterStatsAffectingMutation<T>(
  db: DbClient,
  work: () => T | Promise<T>,
  options?: { invalidate?: (result: T) => boolean },
): Promise<T> {
  const result = await work();
  const shouldInvalidate = options?.invalidate ?? (() => true);
  if (shouldInvalidate(result)) {
    await invalidateStatsCache(db);
  }
  return result;
}
