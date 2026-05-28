import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchReadingGoal, setReadingGoal } from '@/api';

export function useReadingGoal(year: number, enabled: boolean) {
  return useQuery({
    queryKey: ['reading-goals', year],
    queryFn: () => fetchReadingGoal(year),
    enabled,
  });
}

export function useSetReadingGoal(year: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (books: number | null) => setReadingGoal(year, books),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reading-goals', year] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
