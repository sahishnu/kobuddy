/** Fiction quote shown on the app splash (admin-managed, stored in DB). */

/** Max length for quote body (API and admin UI). */
export const LOADING_QUOTE_TEXT_MAX = 500;

/** Max length for author name. */
export const LOADING_QUOTE_AUTHOR_MAX = 120;

/** Max length for book title. */
export const LOADING_QUOTE_BOOK_MAX = 200;

export type LoadingQuote = {
  id: number;
  text: string;
  author: string;
  book: string;
  enabled: boolean;
  sortOrder: number;
};

export type LoadingQuoteInput = {
  text: string;
  author: string;
  book: string;
  enabled?: boolean;
  sortOrder?: number;
};

export type LoadingQuoteListResponse = {
  items: LoadingQuote[];
};

export type SyncLoadingQuotesResponse = {
  mode: 'if-empty' | 'replace';
  inserted: number;
  skipped: boolean;
};
