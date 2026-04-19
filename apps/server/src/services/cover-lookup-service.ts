export type CoverProvider = 'openlibrary' | 'googlebooks';

export type CoverCandidate = {
  provider: CoverProvider;
  providerId: string;
  title: string;
  authors: string;
  year?: number;
  thumbnailUrl?: string;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

type OlSearchDoc = {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
};

type OlSearchResponse = { docs?: OlSearchDoc[] };

type GoogleVolume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
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

export async function fetchCoverBytes(
  candidate: CoverCandidate,
): Promise<Buffer | null> {
  let url: string | undefined;
  if (
    candidate.provider === 'openlibrary' &&
    candidate.providerId.startsWith('id:')
  ) {
    const id = candidate.providerId.slice(3);
    url = `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`;
  }
  if (candidate.provider === 'googlebooks' && candidate.thumbnailUrl) {
    url = candidate.thumbnailUrl.replace('http:', 'https:');
  }
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) return null;
  return buf;
}
