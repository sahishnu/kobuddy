import type { LoadingQuoteInput } from '@kobuddy/common';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createLoadingQuote,
  deleteLoadingQuote,
  fetchLoadingQuotes,
  fetchRandomLoadingQuote,
  syncDefaultLoadingQuotes,
  updateLoadingQuote,
} from '@/api';

const loadingQuotesKey = ['loading-quotes'] as const;

/** Random quote for the one-time app splash (full page load). */
export function useRandomLoadingQuote() {
  return useQuery({
    queryKey: [...loadingQuotesKey, 'random'],
    queryFn: fetchRandomLoadingQuote,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Full list for admin CRUD (preferences dialog). */
export function useLoadingQuotes(enabled: boolean) {
  return useQuery({
    queryKey: loadingQuotesKey,
    queryFn: fetchLoadingQuotes,
    enabled,
    select: (data) => data.items,
  });
}

function invalidateLoadingQuotes(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: loadingQuotesKey });
}

export function useCreateLoadingQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoadingQuoteInput) => createLoadingQuote(input),
    onSuccess: () => invalidateLoadingQuotes(qc),
  });
}

export function useUpdateLoadingQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: LoadingQuoteInput }) =>
      updateLoadingQuote(id, input),
    onSuccess: () => invalidateLoadingQuotes(qc),
  });
}

export function useDeleteLoadingQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteLoadingQuote(id),
    onSuccess: () => invalidateLoadingQuotes(qc),
  });
}

/** Replace DB quotes with the list baked into the deployed server build. */
export function useSyncDefaultLoadingQuotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncDefaultLoadingQuotes(),
    onSuccess: () => invalidateLoadingQuotes(qc),
  });
}
