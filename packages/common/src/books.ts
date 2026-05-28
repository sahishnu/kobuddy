/** External API used to resolve cover art and ISBN metadata. */
export type CoverProviderName = 'openlibrary' | 'googlebooks';

/** One browsable cover match from a provider (wire + admin UI). */
export type CoverCandidate = {
  provider: CoverProviderName;
  providerId: string;
  title: string;
  authors: string;
  year?: number;
  thumbnailUrl?: string;
};

/** One ISBN-bearing edition match from a provider search. */
export type IsbnCandidate = {
  provider: CoverProviderName;
  providerId: string;
  title: string;
  authors: string;
  year?: number;
  /** Normalized digits-only ISBN (10 or 13 chars). */
  isbn: string;
};

/** One row from `GET /api/books` (aggregated across `BookDevice` rows). */
export type BookListItem = {
  md5: string;
  title: string | null;
  customTitle: string | null;
  authors: string | null;
  series: string | null;
  language: string | null;
  isbn: string | null;
  hidden: boolean;
  completedAt: number | null;
  coverPath: string | null;
  coverSource: string | null;
  lastOpen: number | null;
  totalReadTime: number;
  totalReadPages: number;
  pages: number;
  percentComplete: number;
  completed: boolean;
  displayTitle: string;
  coverUrl: string | null;
};

/** Paginated `GET /api/books` response when `page` is set. */
export type BookListPage = {
  items: BookListItem[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * The `book` object inside `GET /api/books/:md5` (full `Book` row plus display fields).
 * After JSON serialization, `createdAt` is an ISO 8601 string.
 */
export type BookDetail = {
  md5: string;
  title: string | null;
  customTitle: string | null;
  authors: string | null;
  series: string | null;
  language: string | null;
  isbn: string | null;
  hidden: boolean;
  completedAt: number | null;
  coverPath: string | null;
  coverSource: string | null;
  createdAt: string;
  displayTitle: string;
  coverUrl: string | null;
};
