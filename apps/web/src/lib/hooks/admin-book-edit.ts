import type { CoverCandidate } from '@kobuddy/common';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyAutoCover,
  applyAutoIsbn,
  deleteBookCover,
  fetchCoverCandidates,
  fetchIsbnCandidates,
  setBookHidden,
  type UpdateBookPayload,
  updateBook,
  uploadBookCover,
} from '@/api';
import { invalidateBooksAndStats } from '@/lib/invalidate-queries';

export function useCoverCandidates(
  md5: string,
  query: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['book-cover-candidates', md5, query],
    queryFn: () => fetchCoverCandidates(md5, query),
    enabled: enabled && Boolean(md5),
  });
}

export function useIsbnCandidates(
  md5: string,
  query: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['book-isbn-candidates', md5, query],
    queryFn: () => fetchIsbnCandidates(md5, query),
    enabled: enabled && Boolean(md5),
  });
}

export type SaveBookMetadataInput = {
  md5: string;
  body: UpdateBookPayload;
  hidden: boolean;
  previousHidden: boolean;
};

export function useSaveBookMetadata() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      md5,
      body,
      hidden,
      previousHidden,
    }: SaveBookMetadataInput) => {
      await updateBook(md5, body);
      if (hidden !== previousHidden) {
        await setBookHidden(md5, hidden);
      }
    },
    onSuccess: () => invalidateBooksAndStats(queryClient),
  });
}

export function useAutoCover(md5: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => applyAutoCover(md5),
    onSuccess: () => invalidateBooksAndStats(queryClient),
  });
}

export function useApplyCoverCandidate(md5: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (candidate: CoverCandidate) =>
      applyAutoCover(md5, {
        provider: candidate.provider,
        providerId: candidate.providerId,
        ...(candidate.thumbnailUrl
          ? { thumbnailUrl: candidate.thumbnailUrl.replace('http:', 'https:') }
          : {}),
      }),
    onSuccess: () => invalidateBooksAndStats(queryClient),
  });
}

export function useDeleteBookCover(md5: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteBookCover(md5),
    onSuccess: () => invalidateBooksAndStats(queryClient),
  });
}

export function useUploadBookCover(md5: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadBookCover(md5, file),
    onSuccess: () => invalidateBooksAndStats(queryClient),
  });
}

export function useAutoIsbn(md5: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => applyAutoIsbn(md5),
    onSuccess: () => invalidateBooksAndStats(queryClient),
  });
}

export function useApplyIsbnCandidate(md5: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isbn: string) => applyAutoIsbn(md5, isbn),
    onSuccess: () => invalidateBooksAndStats(queryClient),
  });
}
