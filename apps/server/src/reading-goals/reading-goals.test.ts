import { describe, expect, it } from 'vitest';
import { statsOverview } from '../stats/index.js';
import { localYear } from '../stats/stats-tz.js';
import { createInMemoryDb } from '../test-util/in-memory-db.js';
import {
  clearReadingGoalForYear,
  getReadingGoalForYear,
  setReadingGoalForYear,
} from './reading-goals.js';

describe('reading goals', () => {
  it('returns null when unset', async () => {
    const db = createInMemoryDb();
    expect(await getReadingGoalForYear(db, 2026)).toBeNull();
  });

  it('persists and clears a goal', async () => {
    const db = createInMemoryDb();
    await setReadingGoalForYear(db, 2026, 24);
    expect(await getReadingGoalForYear(db, 2026)).toBe(24);
    await clearReadingGoalForYear(db, 2026);
    expect(await getReadingGoalForYear(db, 2026)).toBeNull();
  });
});

describe('statsOverview reading goal', () => {
  it('includes goal for the overview local year', async () => {
    const db = createInMemoryDb();
    const year = localYear(Math.floor(Date.now() / 1000), 'UTC');
    await setReadingGoalForYear(db, year, 15);
    const o = await statsOverview(db, 'UTC');
    expect(o.readingGoalBooksPerYear).toBe(15);
  });
});
