import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGoogleBooksProvider } from './google-books.js';

describe('createGoogleBooksProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes API key in volumes search when provided', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      );
    const p = createGoogleBooksProvider();
    await p.searchCoverCandidates({
      title: 'T',
      authors: 'A',
      googleBooksApiKey: 'sekret',
    });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('key=sekret');
    expect(url).toContain('googleapis.com/books/v1/volumes');
  });

  it('maps volume to CoverCandidate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'vol1',
              volumeInfo: {
                title: 'Hi',
                authors: ['Z'],
                publishedDate: '2020-03-01',
                imageLinks: {
                  thumbnail: 'http://books.google.com/thumb.jpg',
                },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const p = createGoogleBooksProvider();
    const list = await p.searchCoverCandidates({ title: 'a', authors: 'b' });
    expect(list[0]).toMatchObject({
      provider: 'googlebooks',
      providerId: 'vol1',
      title: 'Hi',
      authors: 'Z',
      year: 2020,
      thumbnailUrl: 'http://books.google.com/thumb.jpg',
    });
  });

  it('fetchCoverBytes rewrites http thumbnail to https', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(Buffer.alloc(600), { status: 200 }));
    const p = createGoogleBooksProvider();
    const buf = await p.fetchCoverBytes({
      provider: 'googlebooks',
      providerId: 'x',
      title: '',
      authors: '',
      thumbnailUrl: 'http://example.com/c.jpg',
    });
    expect(buf).not.toBeNull();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://example.com/c.jpg',
    );
  });

  it('fetchCoverBytes loads volume when thumbnailUrl missing', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/volumes/vol99')) {
          return new Response(
            JSON.stringify({
              volumeInfo: {
                imageLinks: {
                  smallThumbnail: 'http://ssl.google.com/s.jpg',
                },
              },
            }),
            { status: 200 },
          );
        }
        return new Response(Buffer.alloc(600), { status: 200 });
      });
    const p = createGoogleBooksProvider();
    await p.fetchCoverBytes(
      {
        provider: 'googlebooks',
        providerId: 'vol99',
        title: '',
        authors: '',
      },
      'k',
    );
    const volumeUrl = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('/volumes/vol99'),
    );
    expect(volumeUrl).toBeDefined();
    expect(String(volumeUrl?.[0])).toContain('key=k');
    const imageFetch = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('ssl.google.com'),
    );
    expect(String(imageFetch?.[0])).toBe('https://ssl.google.com/s.jpg');
  });

  it('fetchCoverBytes rejects bodies under 500 bytes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Buffer.alloc(100), { status: 200 }),
    );
    const p = createGoogleBooksProvider();
    const buf = await p.fetchCoverBytes({
      provider: 'googlebooks',
      providerId: 'vol1',
      title: '',
      authors: '',
      thumbnailUrl: 'https://x/y.jpg',
    });
    expect(buf).toBeNull();
  });

  it('searchIsbnCandidates maps industryIdentifiers to normalized isbn', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'g1',
              volumeInfo: {
                title: 'Book',
                authors: ['P'],
                industryIdentifiers: [
                  { type: 'ISBN_13', identifier: '978-0-306-40615-7' },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const p = createGoogleBooksProvider();
    const list = await p.searchIsbnCandidates({ title: 'a', authors: 'b' });
    expect(list).toHaveLength(1);
    expect(list[0].isbn).toBe('9780306406157');
    expect(list[0].providerId).toBe('g1');
  });
});
