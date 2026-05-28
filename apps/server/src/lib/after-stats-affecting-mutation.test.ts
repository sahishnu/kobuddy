import { statsCache } from '@kobuddy/db/schema';
import { describe, expect, it, vi } from 'vitest';
import { createInMemoryDb } from '../test-util/in-memory-db.js';
import { afterStatsAffectingMutation } from './after-stats-affecting-mutation.js';

describe('afterStatsAffectingMutation', () => {
  async function seedCacheRow(db: ReturnType<typeof createInMemoryDb>) {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(statsCache).values({
      key: 'stats:overview:UTC',
      value: '{}',
      computedAt: now,
    });
  }

  it('invalidates stats cache after successful work', async () => {
    const db = createInMemoryDb();
    await seedCacheRow(db);

    await afterStatsAffectingMutation(db, () => ({ ok: true }));

    const left = await db.select().from(statsCache);
    expect(left).toHaveLength(0);
  });

  it('does not invalidate when work throws', async () => {
    const db = createInMemoryDb();
    await seedCacheRow(db);

    await expect(
      afterStatsAffectingMutation(db, () => {
        throw new Error('ingest failed');
      }),
    ).rejects.toThrow('ingest failed');

    const left = await db.select().from(statsCache);
    expect(left).toHaveLength(1);
  });

  it('skips invalidation when invalidate predicate returns false', async () => {
    const db = createInMemoryDb();
    await seedCacheRow(db);

    await afterStatsAffectingMutation(db, () => ({ ok: false as const }), {
      invalidate: (r) => r.ok,
    });

    const left = await db.select().from(statsCache);
    expect(left).toHaveLength(1);
  });

  it('calls invalidateStatsCache only once on success', async () => {
    const db = createInMemoryDb();
    const mod = await import('../stats/index.js');
    const spy = vi.spyOn(mod, 'invalidateStatsCache');

    await afterStatsAffectingMutation(db, () => 1);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(db);
    spy.mockRestore();
  });
});
