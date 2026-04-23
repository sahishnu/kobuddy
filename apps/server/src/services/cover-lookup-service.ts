export type CoverProvider = 'openlibrary' | 'googlebooks';

export type CoverCandidate = {
  provider: CoverProvider;
  providerId: string;
  title: string;
  authors: string;
  year?: number;
  thumbnailUrl?: string;
};

export type IsbnCandidate = {
  provider: CoverProvider;
  providerId: string;
  title: string;
  authors: string;
  year?: number;
  /** Normalized digits-only ISBN (10 or 13 chars). */
  isbn: string;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

type OlSearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
};

type OlSearchResponse = { docs?: OlSearchDoc[] };

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

export async function searchCoverCandidates(
  title: string,
  authors: string,
  isbn: string | null | undefined,
  googleBooksApiKey?: string,
): Promise<CoverCandidate[]> {
  const out: CoverCandidate[] = [];

  if (isbn) {
    const clean = isbn.replaceAll(/[-\s]/g, '');
    if (clean) {
      const url = `https://openlibrary.org/isbn/${encodeURIComponent(clean)}.json`;
      const data = await fetchJson<{
        title?: string;
        authors?: { name?: string }[];
        covers?: number[];
      }>(url);
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

  const qTitle = encodeURIComponent(title || 'unknown');
  const qAuthor = encodeURIComponent(
    (authors || '').split(',')[0]?.trim() || '',
  );
  const ol = await fetchJson<OlSearchResponse>(
    `https://openlibrary.org/search.json?title=${qTitle}&author=${qAuthor}&limit=12`,
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
      year: vi.publishedDate ? Number(vi.publishedDate.slice(0, 4)) : undefined,
      thumbnailUrl: thumb,
    });
  }

  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.provider}:${c.providerId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Normalize to stored form: digits only, ISBN-10 may end with X. */
export function normalizeIsbnForStorage(raw: string): string | null {
  const s = raw.replaceAll(/[-\s]/g, '').toUpperCase();
  if (!s) return null;
  if (/^\d{13}$/.test(s)) return s;
  if (/^\d{9}[\dX]$/.test(s)) return s;
  return null;
}

export function pickPrimaryIsbnFromList(
  arr: string[] | undefined,
): string | null {
  if (!arr?.length) return null;
  const norms: string[] = [];
  for (const raw of arr) {
    const n = normalizeIsbnForStorage(raw);
    if (n) norms.push(n);
  }
  if (!norms.length) return null;
  const uniq = [...new Set(norms)];
  const isbn13 = uniq.find((x) => x.length === 13 && x.startsWith('978'));
  if (isbn13) return isbn13;
  const any13 = uniq.find((x) => x.length === 13);
  if (any13) return any13;
  return uniq.find((x) => x.length === 10) ?? null;
}

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

/** Title/author search on Open Library + Google Books; dedupes by ISBN. */
export async function searchIsbnCandidates(
  title: string,
  authors: string,
  googleBooksApiKey?: string,
): Promise<IsbnCandidate[]> {
  const out: IsbnCandidate[] = [];
  const seen = new Set<string>();

  const push = (c: Omit<IsbnCandidate, 'isbn'> & { isbn: string | null }) => {
    const norm = c.isbn ? normalizeIsbnForStorage(c.isbn) : null;
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    out.push({ ...c, isbn: norm });
  };

  const qTitle = encodeURIComponent(title || 'unknown');
  const qAuthor = encodeURIComponent(
    (authors || '').split(',')[0]?.trim() || '',
  );
  const ol = await fetchJson<OlSearchResponse>(
    `https://openlibrary.org/search.json?title=${qTitle}&author=${qAuthor}&limit=24`,
  );
  for (const doc of ol?.docs ?? []) {
    const isbn = pickPrimaryIsbnFromList(doc.isbn);
    if (!isbn) continue;
    push({
      provider: 'openlibrary',
      providerId: doc.key ?? `ol:${isbn}`,
      title: doc.title ?? title,
      authors: (doc.author_name ?? []).join(', ') || authors,
      year: doc.first_publish_year,
      isbn,
    });
  }

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
    push({
      provider: 'googlebooks',
      providerId: item.id,
      title: vi.title,
      authors: (vi.authors ?? []).join(', '),
      year: vi.publishedDate ? Number(vi.publishedDate.slice(0, 4)) : undefined,
      isbn,
    });
  }

  return out;
}

export async function fetchCoverBytes(
  candidate: CoverCandidate,
  googleBooksApiKey?: string,
): Promise<Buffer | null> {
  let url: string | undefined;
  if (
    candidate.provider === 'openlibrary' &&
    candidate.providerId.startsWith('id:')
  ) {
    const id = candidate.providerId.slice(3);
    url = `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`;
  }
  if (candidate.provider === 'googlebooks') {
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
      const thumb = vi?.imageLinks?.thumbnail ?? vi?.imageLinks?.smallThumbnail;
      if (thumb) url = thumb.replace('http:', 'https:');
    }
  }
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) return null;
  return buf;
}
