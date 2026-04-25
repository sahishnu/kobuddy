import { statsCache } from '@kobuddy/db/schema';
import { eq } from 'drizzle-orm';
import type { DbClient } from '../lib/db.js';
import { ingestLog } from '../lib/logger.js';

const DEFAULT_TTL_SECONDS = 60;

export async function getCachedJson<T>(
  db: DbClient,
  key: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<T | null> {
  try {
    const [row] = await db
      .select()
      .from(statsCache)
      .where(eq(statsCache.key, key))
      .limit(1);
    if (!row) return null;
    const ageSeconds = Math.floor(Date.now() / 1000) - row.computedAt;
    if (ageSeconds > ttlSeconds) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  } catch (err) {
    ingestLog.warn(
      { err: (err as Error).message, key },
      'stats cache read failed; falling back to uncached compute',
    );
    return null;
  }
}

export async function setCachedJson<T>(
  db: DbClient,
  key: string,
  value: T,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  try {
    await db
      .insert(statsCache)
      .values({ key, value: JSON.stringify(value), computedAt: now })
      .onConflictDoUpdate({
        target: statsCache.key,
        set: { value: JSON.stringify(value), computedAt: now },
      });
  } catch (err) {
    ingestLog.warn(
      { err: (err as Error).message, key },
      'stats cache write failed; response will not be cached',
    );
  }
}

export async function invalidateStatsCache(db: DbClient): Promise<void> {
  try {
    await db.delete(statsCache);
  } catch (err) {
    ingestLog.warn(
      { err: (err as Error).message },
      'stats cache invalidation failed',
    );
  }
}
