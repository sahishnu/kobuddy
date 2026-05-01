import type { CoverCandidate, IsbnCandidate } from '@kobuddy/common';
import { normalizeIsbnForStorage } from '../isbn.js';
import { fetchJson } from './http.js';
import type { CoverProvider, CoverSearchInput } from './provider.js';

type GoogleVolumeInfo = {
  title?: string;
  authors?: string[];
  publishedDate?: string;
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  industryIdentifiers?: { type?: string; identifier?: string }[];
};

type GoogleVolume = {
  id?: string;
  volumeInfo?: GoogleVolumeInfo;
};

type GoogleVolumesResponse = { items?: GoogleVolume[] };

function isbnFromGoogleIndustryIds(
  ids: GoogleVolumeInfo['industryIdentifiers'],
): string | null {
  if (!ids?.length) return null;
  const i13 = ids.find((i) => i.type === 'ISBN_13' && i.identifier);
  if (i13?.identifier) return normalizeIsbnForStorage(i13.identifier);
  const i10 = ids.find((i) => i.type === 'ISBN_10' && i.identifier);
  if (i10?.identifier) return normalizeIsbnForStorage(i10.identifier);
  return null;
}

export function createGoogleBooksProvider(): CoverProvider {
  return {
    name: 'googlebooks',

    async searchCoverCandidates({
      title,
      authors,
      googleBooksApiKey,
    }: CoverSearchInput): Promise<CoverCandidate[]> {
      const out: CoverCandidate[] = [];
      const gq = encodeURIComponent(
        `intitle:${title} inauthor:${(authors || '').split(',')[0]?.trim() || authors}`,
      );
      const keyParam = googleBooksApiKey
        ? `&key=${encodeURIComponent(googleBooksApiKey)}`
        : '';
      const gv = await fetchJson<GoogleVolumesResponse>(
        `https://www.googleapis.com/books/v1/volumes?q=${gq}&maxResults=10${keyParam}`,
      );
      for (const item of gv?.items ?? []) {
        const vi = item.volumeInfo;
        if (!item.id || !vi?.title) continue;
        const thumb = vi.imageLinks?.thumbnail ?? vi.imageLinks?.smallThumbnail;
        out.push({
          provider: 'googlebooks',
          providerId: item.id,
          title: vi.title,
          authors: (vi.authors ?? []).join(', '),
          year: vi.publishedDate
            ? Number(vi.publishedDate.slice(0, 4))
            : undefined,
          thumbnailUrl: thumb,
        });
      }
      return out;
    },

    async searchIsbnCandidates({
      title,
      authors,
      googleBooksApiKey,
    }: CoverSearchInput): Promise<IsbnCandidate[]> {
      const out: IsbnCandidate[] = [];
      const gq = encodeURIComponent(
        `intitle:${title} inauthor:${(authors || '').split(',')[0]?.trim() || authors}`,
      );
      const keyParam = googleBooksApiKey
        ? `&key=${encodeURIComponent(googleBooksApiKey)}`
        : '';
      const gv = await fetchJson<GoogleVolumesResponse>(
        `https://www.googleapis.com/books/v1/volumes?q=${gq}&maxResults=12${keyParam}`,
      );
      for (const item of gv?.items ?? []) {
        const vi = item.volumeInfo;
        if (!item.id || !vi?.title) continue;
        const isbn = isbnFromGoogleIndustryIds(vi.industryIdentifiers);
        if (!isbn) continue;
        out.push({
          provider: 'googlebooks',
          providerId: item.id,
          title: vi.title,
          authors: (vi.authors ?? []).join(', '),
          year: vi.publishedDate
            ? Number(vi.publishedDate.slice(0, 4))
            : undefined,
          isbn,
        });
      }
      return out;
    },

    async fetchCoverBytes(
      candidate: CoverCandidate,
      googleBooksApiKey?: string,
    ): Promise<Buffer | null> {
      if (candidate.provider !== 'googlebooks') return null;

      let url: string | undefined;
      if (candidate.thumbnailUrl) {
        url = candidate.thumbnailUrl.replace('http:', 'https:');
      } else if (candidate.providerId) {
        const keyParam = googleBooksApiKey
          ? `?key=${encodeURIComponent(googleBooksApiKey)}`
          : '';
        const vol = await fetchJson<{ volumeInfo?: GoogleVolumeInfo }>(
          `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(candidate.providerId)}${keyParam}`,
        );
        const vi = vol?.volumeInfo;
        const thumb =
          vi?.imageLinks?.thumbnail ?? vi?.imageLinks?.smallThumbnail;
        if (thumb) url = thumb.replace('http:', 'https:');
      }
      if (!url) return null;
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) return null;
      return buf;
    },
  };
}
