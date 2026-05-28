import {
  LOADING_QUOTE_AUTHOR_MAX,
  LOADING_QUOTE_BOOK_MAX,
  LOADING_QUOTE_TEXT_MAX,
  type LoadingQuote,
  type LoadingQuoteInput,
} from '@kobuddy/common';

export type LoadingQuoteDraft = {
  text: string;
  author: string;
  book: string;
  enabled: boolean;
};

export function emptyLoadingQuoteDraft(): LoadingQuoteDraft {
  return { text: '', author: '', book: '', enabled: true };
}

export function loadingQuoteDraftFromRow(q: LoadingQuote): LoadingQuoteDraft {
  return {
    text: q.text,
    author: q.author,
    book: q.book,
    enabled: q.enabled,
  };
}

export function validateLoadingQuoteDraft(
  draft: LoadingQuoteDraft,
): string | null {
  const text = draft.text.trim();
  const author = draft.author.trim();
  const book = draft.book.trim();
  if (!text || !author || !book) {
    return 'Quote, author, and book are required.';
  }
  if (text.length > LOADING_QUOTE_TEXT_MAX) {
    return `Quote must be at most ${LOADING_QUOTE_TEXT_MAX} characters.`;
  }
  if (author.length > LOADING_QUOTE_AUTHOR_MAX) {
    return `Author must be at most ${LOADING_QUOTE_AUTHOR_MAX} characters.`;
  }
  if (book.length > LOADING_QUOTE_BOOK_MAX) {
    return `Book must be at most ${LOADING_QUOTE_BOOK_MAX} characters.`;
  }
  return null;
}

export function loadingQuoteDraftToInput(
  draft: LoadingQuoteDraft,
): LoadingQuoteInput {
  return {
    text: draft.text.trim(),
    author: draft.author.trim(),
    book: draft.book.trim(),
    enabled: draft.enabled,
  };
}
