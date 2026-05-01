import type { CoverCandidate, IsbnCandidate } from '@kobuddy/common';
import { createGoogleBooksProvider } from './providers/google-books.js';
import { createOpenLibraryProvider } from './providers/open-library.js';
import type { CoverProvider } from './providers/provider.js';

const providers: CoverProvider[] = [
  createOpenLibraryProvider(),
  createGoogleBooksProvider(),
];

function dedupeCoverCandidates(items: CoverCandidate[]): CoverCandidate[] {
  const seen = new Set<string>();
  return items.filter((c) => {
    const k = `${c.provider}:${c.providerId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function searchCoverCandidates(
  title: string,
  authors: string,
  isbn: string | null | undefined,
  googleBooksApiKey?: string,
): Promise<CoverCandidate[]> {
  const input = { title, authors, isbn, googleBooksApiKey };
  const chunks = await Promise.all(
    providers.map((p) => p.searchCoverCandidates(input)),
  );
  return dedupeCoverCandidates(chunks.flat());
}

export async function searchIsbnCandidates(
  title: string,
  authors: string,
  googleBooksApiKey?: string,
): Promise<IsbnCandidate[]> {
  const input = { title, authors, googleBooksApiKey };
  const chunks = await Promise.all(
    providers.map((p) => p.searchIsbnCandidates(input)),
  );
  const merged = chunks.flat();
  const seen = new Set<string>();
  const out: IsbnCandidate[] = [];
  for (const c of merged) {
    if (seen.has(c.isbn)) continue;
    seen.add(c.isbn);
    out.push(c);
  }
  return out;
}

export async function fetchCoverBytes(
  candidate: CoverCandidate,
  googleBooksApiKey?: string,
): Promise<Buffer | null> {
  const p = providers.find((x) => x.name === candidate.provider);
  if (!p) return null;
  return p.fetchCoverBytes(candidate, googleBooksApiKey);
}
