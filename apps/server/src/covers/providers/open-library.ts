import type { CoverCandidate, IsbnCandidate } from '@kobuddy/common';
import { pickPrimaryIsbnFromList } from '../isbn.js';
import { fetchJson } from './http.js';
import type { CoverProvider, CoverSearchInput } from './provider.js';

type OlSearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
};

type OlSearchResponse = { docs?: OlSearchDoc[] };

/** OL search omits `isbn` on docs unless requested via `fields`. */
const OL_ISBN_SEARCH_FIELDS = 'key,title,author_name,first_publish_year,isbn';

const OL_COVER_SEARCH_FIELDS =
  'key,title,author_name,first_publish_year,cover_i';

function olTitleAuthorSearchUrl(
  title: string,
  authors: string,
  limit: number,
  fields: string,
): string {
  const qTitle = encodeURIComponent(title || 'unknown');
  const qAuthor = encodeURIComponent(
    (authors || '').split(',')[0]?.trim() || '',
  );
  return `https://openlibrary.org/search.json?title=${qTitle}&author=${qAuthor}&limit=${limit}&fields=${encodeURIComponent(fields)}`;
}

export function createOpenLibraryProvider(): CoverProvider {
  return {
    name: 'openlibrary',

    async searchCoverCandidates({
      title,
      authors,
      isbn,
    }: CoverSearchInput): Promise<CoverCandidate[]> {
      const out: CoverCandidate[] = [];

      if (isbn) {
        const clean = isbn.replaceAll(/[-\s]/g, '');
        if (clean) {
          const url = `https://openlibrary.org/isbn/${encodeURIComponent(clean)}.json`;
          const data = await fetchJson<{
            title?: string;
            authors?: { name?: string }[];
            covers?: number[];
          }>(url, { provider: 'openlibrary' });
          if (data?.covers?.[0]) {
            out.push({
              provider: 'openlibrary',
              providerId: `id:${data.covers[0]}`,
              title: data.title ?? title,
              authors:
                data.authors
                  ?.map((a) => a.name)
                  .filter(Boolean)
                  .join(', ') || authors,
              thumbnailUrl: `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg?default=false`,
            });
          }
        }
      }

      const ol = await fetchJson<OlSearchResponse>(
        olTitleAuthorSearchUrl(title, authors, 12, OL_COVER_SEARCH_FIELDS),
        { provider: 'openlibrary' },
      );
      for (const doc of ol?.docs ?? []) {
        if (!doc.cover_i) continue;
        out.push({
          provider: 'openlibrary',
          providerId: `id:${doc.cover_i}`,
          title: doc.title ?? title,
          authors: (doc.author_name ?? []).join(', ') || authors,
          year: doc.first_publish_year,
          thumbnailUrl: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg?default=false`,
        });
      }

      return out;
    },

    async searchIsbnCandidates({
      title,
      authors,
    }: CoverSearchInput): Promise<IsbnCandidate[]> {
      const out: IsbnCandidate[] = [];

      const ol = await fetchJson<OlSearchResponse>(
        olTitleAuthorSearchUrl(title, authors, 24, OL_ISBN_SEARCH_FIELDS),
        { provider: 'openlibrary' },
      );
      for (const doc of ol?.docs ?? []) {
        const normIsbn = pickPrimaryIsbnFromList(doc.isbn);
        if (!normIsbn) continue;
        out.push({
          provider: 'openlibrary',
          providerId: doc.key ?? `ol:${normIsbn}`,
          title: doc.title ?? title,
          authors: (doc.author_name ?? []).join(', ') || authors,
          year: doc.first_publish_year,
          isbn: normIsbn,
        });
      }

      return out;
    },

    async fetchCoverBytes(candidate: CoverCandidate): Promise<Buffer | null> {
      if (candidate.provider !== 'openlibrary') return null;
      if (!candidate.providerId.startsWith('id:')) return null;
      const id = candidate.providerId.slice(3);
      const url = `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) return null;
      return buf;
    },
  };
}
