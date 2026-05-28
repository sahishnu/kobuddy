import type { StatsOverview } from '@kobuddy/common';
import { apiJson } from './client.js';

export function fetchStatsOverview(timeZone: string): Promise<StatsOverview> {
  const qs = new URLSearchParams({ timeZone }).toString();
  return apiJson<StatsOverview>(`/api/stats?${qs}`);
}
