import type { QueryClient } from '@tanstack/react-query';

/** Book list queries (`['books', …]`). */
export function invalidateBooks(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['books'] });
}

/** Dashboard stats (`['stats', timeZone]`). */
export function invalidateStats(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['stats'] });
}

/**
 * After mutations that change data shown on the home dashboard or library lists.
 * Pairs with server `afterStatsAffectingMutation` — client must drop cached overview too.
 */
export function invalidateBooksAndStats(queryClient: QueryClient): void {
  invalidateBooks(queryClient);
  invalidateStats(queryClient);
}
