import { readingGoal } from '@kobuddy/db/schema';
import { eq } from 'drizzle-orm';
import type { DbClient } from '../lib/db.js';

export async function getReadingGoalForYear(
  db: DbClient,
  year: number,
): Promise<number | null> {
  const [row] = await db
    .select({ books: readingGoal.books })
    .from(readingGoal)
    .where(eq(readingGoal.year, year))
    .limit(1);
  return row?.books ?? null;
}

export async function setReadingGoalForYear(
  db: DbClient,
  year: number,
  books: number,
): Promise<void> {
  await db.insert(readingGoal).values({ year, books }).onConflictDoUpdate({
    target: readingGoal.year,
    set: { books },
  });
}

export async function clearReadingGoalForYear(
  db: DbClient,
  year: number,
): Promise<void> {
  await db.delete(readingGoal).where(eq(readingGoal.year, year));
}
