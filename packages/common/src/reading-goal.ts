/** Upper bound for annual books goal (admin UI and API). */
export const READING_GOAL_MAX_BOOKS = 9999;

/** Annual books target for a calendar year (admin-configured). */
export type ReadingGoalResponse = {
  year: number;
  books: number | null;
};
