import type { ReadingGoalResponse } from '@kobuddy/common';
import { apiJson } from './client.js';

export function fetchReadingGoal(year: number): Promise<ReadingGoalResponse> {
  return apiJson<ReadingGoalResponse>(`/api/reading-goals/${year}`);
}

export function setReadingGoal(
  year: number,
  books: number | null,
): Promise<ReadingGoalResponse> {
  return apiJson<ReadingGoalResponse>(`/api/reading-goals/${year}`, {
    method: 'PUT',
    body: JSON.stringify({ books }),
  });
}
