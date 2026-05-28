import { useQuery } from '@tanstack/react-query';
import { fetchStatsOverview } from '@/api';

export function useStatsOverview(timeZone: string) {
  return useQuery({
    queryKey: ['stats', timeZone],
    queryFn: () => fetchStatsOverview(timeZone),
  });
}
