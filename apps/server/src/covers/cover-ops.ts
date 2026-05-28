import type { CoverCandidate } from '@kobuddy/common';
import { getBookRow } from '../books/books.js';
import type { AppConfig } from '../config.js';
import type { DbClient } from '../lib/db.js';
import { displayTitle } from '../lib/display.js';
import { fetchCoverBytes, searchCoverCandidates } from './lookup.js';
import { deleteCoverFile, readCoverFile, saveCoverFile } from './storage.js';

export async function applyCoverCandidate(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
  candidate: CoverCandidate,
): Promise<boolean> {
  const bytes = await fetchCoverBytes(candidate, cfg.GOOGLE_BOOKS_API_KEY);
  if (!bytes) return false;
  await saveCoverFile(
    db,
    cfg,
    md5,
    bytes,
    `${candidate.provider}:${candidate.providerId}`,
  );
  return true;
}

export async function applyCustomCover(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
  bytes: Buffer,
): Promise<void> {
  await saveCoverFile(db, cfg, md5, bytes, 'manual');
}

export async function readCoverBytes(
  cfg: AppConfig,
  coverPath: string,
): Promise<Buffer | null> {
  return readCoverFile(cfg, coverPath);
}

export async function deleteCover(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
): Promise<void> {
  await deleteCoverFile(db, cfg, md5);
}

export async function autoCoverAfterIsbnChange(
  db: DbClient,
  cfg: AppConfig,
  md5: string,
  hadManualCover: boolean,
  newIsbn: string | null,
): Promise<void> {
  if (hadManualCover || !newIsbn) return;
  const b = await getBookRow(db, md5);
  if (!b?.isbn) return;
  const candidates = await searchCoverCandidates(
    displayTitle(b),
    b.authors ?? '',
    b.isbn,
    cfg.GOOGLE_BOOKS_API_KEY,
  );
  const first = candidates[0];
  if (!first) return;
  await applyCoverCandidate(db, cfg, md5, first);
}
