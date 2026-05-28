import type { CoverCandidate, IsbnCandidate } from '@kobuddy/common';
import {
  getBookRow,
  type UpdateBookResult,
  updateBook,
} from '../books/books.js';
import type { AppConfig } from '../config.js';
import type { DbClient } from '../lib/db.js';
import { displayTitle } from '../lib/display.js';
import { applyCoverCandidate, autoCoverAfterIsbnChange } from './cover-ops.js';
import { normalizeIsbnForStorage } from './isbn.js';
import { searchCoverCandidates, searchIsbnCandidates } from './lookup.js';
import { readCoverFile } from './storage.js';

export type CoverAutoInput = {
  provider?: 'openlibrary' | 'googlebooks';
  providerId?: string;
  thumbnailUrl?: string;
};

export type IsbnAutoInput = {
  isbn?: string;
};

function searchTitle(
  row: { title: string | null; customTitle: string | null },
  query?: string,
): string {
  const q = query?.trim();
  return q ? q : displayTitle(row);
}

export async function coverCandidatesForBook(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
  opts?: { query?: string },
): Promise<
  { ok: true; candidates: CoverCandidate[] } | { ok: false; error: 'not_found' }
> {
  const b = await getBookRow(db, md5);
  if (!b) return { ok: false, error: 'not_found' };
  const candidates = await searchCoverCandidates(
    searchTitle(b, opts?.query),
    b.authors ?? '',
    b.isbn,
    cfg.GOOGLE_BOOKS_API_KEY,
  );
  return { ok: true, candidates };
}

export async function isbnCandidatesForBook(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
  opts?: { query?: string },
): Promise<
  { ok: true; candidates: IsbnCandidate[] } | { ok: false; error: 'not_found' }
> {
  const b = await getBookRow(db, md5);
  if (!b) return { ok: false, error: 'not_found' };
  const candidates = await searchIsbnCandidates(
    searchTitle(b, opts?.query),
    b.authors ?? '',
    cfg.GOOGLE_BOOKS_API_KEY,
  );
  return { ok: true, candidates };
}

export async function applyAutoCoverForBook(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
  body: CoverAutoInput = {},
): Promise<
  | { ok: true; coverSource: string }
  | { ok: false; error: 'not_found' | 'no_cover' | 'download_failed' }
> {
  const b = await getBookRow(db, md5);
  if (!b) return { ok: false, error: 'not_found' };

  let candidate: CoverCandidate | null = null;
  if (body.provider && body.providerId) {
    candidate = {
      provider: body.provider,
      providerId: body.providerId,
      title: displayTitle(b),
      authors: b.authors ?? '',
      thumbnailUrl: body.thumbnailUrl,
    };
  } else {
    const candidates = await searchCoverCandidates(
      displayTitle(b),
      b.authors ?? '',
      b.isbn,
      cfg.GOOGLE_BOOKS_API_KEY,
    );
    candidate = candidates[0] ?? null;
  }
  if (!candidate) return { ok: false, error: 'no_cover' };

  const applied = await applyCoverCandidate(db, cfg, md5, candidate);
  if (!applied) return { ok: false, error: 'download_failed' };
  return {
    ok: true,
    coverSource: `${candidate.provider}:${candidate.providerId}`,
  };
}

export async function serveCoverBytesForBook(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
): Promise<
  { ok: true; bytes: Buffer } | { ok: false; error: 'not_found' | 'no_cover' }
> {
  const b = await getBookRow(db, md5);
  if (!b?.coverPath) return { ok: false, error: b ? 'no_cover' : 'not_found' };
  const bytes = await readCoverFile(cfg, b.coverPath);
  if (!bytes) return { ok: false, error: 'no_cover' };
  return { ok: true, bytes };
}

export async function applyCoverPolicyAfterBookUpdate(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
  result: Extract<UpdateBookResult, { found: true }>,
): Promise<void> {
  if (!result.isbnChanged) return;
  await autoCoverAfterIsbnChange(
    db,
    cfg,
    md5,
    result.hadManualCover,
    result.nextIsbn,
  );
}

export async function applyIsbnAutoForBook(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
  body: IsbnAutoInput = {},
): Promise<
  | { ok: true; isbn: string }
  | { ok: false; error: 'not_found' | 'no_isbn' | 'invalid_isbn' }
> {
  const existing = await getBookRow(db, md5);
  if (!existing) return { ok: false, error: 'not_found' };

  let nextIsbn: string | null;
  if (body.isbn) {
    nextIsbn = normalizeIsbnForStorage(body.isbn);
    if (!nextIsbn) return { ok: false, error: 'invalid_isbn' };
  } else {
    const list = await searchIsbnCandidates(
      displayTitle(existing),
      existing.authors ?? '',
      cfg.GOOGLE_BOOKS_API_KEY,
    );
    const first = list[0];
    if (!first) return { ok: false, error: 'no_isbn' };
    nextIsbn = first.isbn;
  }

  const updated = await updateBook(db, md5, { isbn: nextIsbn });
  if (!updated.found) return { ok: false, error: 'not_found' };
  await applyCoverPolicyAfterBookUpdate(db, cfg, md5, updated);
  return { ok: true, isbn: nextIsbn };
}
