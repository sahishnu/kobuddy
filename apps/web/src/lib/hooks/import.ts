import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importKoreaderSqlite } from '@/api';
import { invalidateBooksAndStats } from '@/lib/invalidate-queries';

export function useImportKoreaderSqlite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, deviceId }: { file: File; deviceId?: string }) =>
      importKoreaderSqlite(file, deviceId),
    onSuccess: () => invalidateBooksAndStats(queryClient),
  });
}
