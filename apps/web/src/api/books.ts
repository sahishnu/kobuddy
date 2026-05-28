import type {
  BookListItem,
  BookListPage,
  CoverCandidate,
  IsbnCandidate,
} from '@kobuddy/common';
import { apiJson } from './client.js';

type OkResponse = { ok: boolean };

export type ListBooksParams = {
  sort?: 'lastOpen';
  limit?: number;
  shelf?: boolean;
  showHidden?: boolean;
};

export type BooksPageParams = {
  page: number;
  pageSize?: number;
  q?: string;
  sort?: 'lastOpen';
  hiddenOnly?: boolean;
};

export type AdminBooksPageParams = BooksPageParams;

function booksListPath(params?: ListBooksParams): string {
  if (!params) return '/api/books';
  const q = new URLSearchParams();
  if (params.sort) q.set('sort', params.sort);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.shelf) q.set('shelf', 'true');
  if (params.showHidden) q.set('showHidden', 'true');
  const qs = q.toString();
  return qs ? `/api/books?${qs}` : '/api/books';
}

export function fetchBooks(params?: ListBooksParams): Promise<BookListItem[]> {
  return apiJson<BookListItem[]>(booksListPath(params));
}

export function fetchHomeShelfBooks(): Promise<BookListItem[]> {
  return fetchBooks({ sort: 'lastOpen', limit: 8, shelf: true });
}

export function fetchBooksPage(params: BooksPageParams): Promise<BookListPage> {
  const q = new URLSearchParams();
  q.set('page', String(params.page));
  if (params.sort) q.set('sort', params.sort);
  if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
  if (params.q?.trim()) q.set('q', params.q.trim());
  if (params.hiddenOnly) q.set('hiddenOnly', 'true');
  return apiJson<BookListPage>(`/api/books?${q.toString()}`);
}

export function fetchAdminBooksPage(
  params: AdminBooksPageParams,
): Promise<BookListPage> {
  return fetchBooksPage({ ...params, sort: 'lastOpen' });
}

export type UpdateBookPayload = {
  customTitle: string | null;
  authors: string | null;
  isbn: string | null;
  completed: boolean;
  completedAt?: number;
};

export function updateBook(
  md5: string,
  body: UpdateBookPayload,
): Promise<OkResponse> {
  return apiJson<OkResponse>(`/api/books/${md5}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function setBookHidden(
  md5: string,
  hidden: boolean,
): Promise<OkResponse> {
  return apiJson<OkResponse>(`/api/books/${md5}/hide`, {
    method: 'PUT',
    body: JSON.stringify({ hidden }),
  });
}

export type AutoCoverPayload = {
  provider?: CoverCandidate['provider'];
  providerId?: string;
  thumbnailUrl?: string;
};

export function applyAutoCover(
  md5: string,
  body: AutoCoverPayload = {},
): Promise<OkResponse> {
  return apiJson<OkResponse>(`/api/books/${md5}/cover/auto`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteBookCover(md5: string): Promise<OkResponse> {
  return apiJson<OkResponse>(`/api/books/${md5}/cover`, { method: 'DELETE' });
}

export function uploadBookCover(md5: string, file: File): Promise<OkResponse> {
  const fd = new FormData();
  fd.set('file', file);
  return apiJson<OkResponse>(`/api/books/${md5}/cover`, {
    method: 'POST',
    body: fd,
  });
}

export function fetchCoverCandidates(
  md5: string,
  query?: string,
): Promise<{ candidates: CoverCandidate[] }> {
  const q = new URLSearchParams();
  if (query?.trim()) q.set('q', query.trim());
  const qs = q.toString();
  return apiJson<{ candidates: CoverCandidate[] }>(
    `/api/books/${md5}/cover/candidates${qs ? `?${qs}` : ''}`,
  );
}

export function fetchIsbnCandidates(
  md5: string,
  query?: string,
): Promise<{ candidates: IsbnCandidate[] }> {
  const q = new URLSearchParams();
  if (query?.trim()) q.set('q', query.trim());
  const qs = q.toString();
  return apiJson<{ candidates: IsbnCandidate[] }>(
    `/api/books/${md5}/isbn/candidates${qs ? `?${qs}` : ''}`,
  );
}

export function applyAutoIsbn(
  md5: string,
  isbn?: string,
): Promise<{ ok: boolean; isbn: string }> {
  return apiJson<{ ok: boolean; isbn: string }>(`/api/books/${md5}/isbn/auto`, {
    method: 'POST',
    body: JSON.stringify(isbn ? { isbn } : {}),
  });
}

export type ImportSqliteResult = {
  ok: boolean;
  booksImported: number;
  pageStatsImported: number;
  pageStatsFiltered?: number;
  message?: string;
};

export function importKoreaderSqlite(
  file: File,
  deviceId?: string,
): Promise<ImportSqliteResult> {
  const fd = new FormData();
  fd.append('file', file);
  if (deviceId?.trim()) fd.append('device_id', deviceId.trim());
  return apiJson<ImportSqliteResult>('/api/books/import-sqlite', {
    method: 'POST',
    body: fd,
  });
}

/** Cover image URL for admin preview (cache-bust with nonce). */
export function bookCoverImagePath(md5: string, cacheNonce: number): string {
  return `/api/books/${md5}/cover?v=${cacheNonce}`;
}
