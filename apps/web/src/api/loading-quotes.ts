import type {
  LoadingQuote,
  LoadingQuoteInput,
  LoadingQuoteListResponse,
  SyncLoadingQuotesResponse,
} from '@kobuddy/common';
import { apiJson } from './client.js';

export function fetchRandomLoadingQuote(): Promise<LoadingQuote> {
  return apiJson<LoadingQuote>('/api/loading-quotes/random');
}

export function fetchLoadingQuotes(): Promise<LoadingQuoteListResponse> {
  return apiJson<LoadingQuoteListResponse>('/api/loading-quotes');
}

export function createLoadingQuote(
  input: LoadingQuoteInput,
): Promise<LoadingQuote> {
  return apiJson<LoadingQuote>('/api/loading-quotes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateLoadingQuote(
  id: number,
  input: LoadingQuoteInput,
): Promise<LoadingQuote> {
  return apiJson<LoadingQuote>(`/api/loading-quotes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function syncDefaultLoadingQuotes(): Promise<SyncLoadingQuotesResponse> {
  return apiJson<SyncLoadingQuotesResponse>(
    '/api/loading-quotes/sync-defaults',
    { method: 'POST' },
  );
}

export function deleteLoadingQuote(id: number): Promise<{ ok: true }> {
  return apiJson<{ ok: true }>(`/api/loading-quotes/${id}`, {
    method: 'DELETE',
  });
}
