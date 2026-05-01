import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenLibraryProvider } from './open-library.js';

describe('createOpenLibraryProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('searchCoverCandidates requests OL search with encoded title and author', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ docs: [] }), { status: 200 }),
      );
    const p = createOpenLibraryProvider();
    await p.searchCoverCandidates({
      title: 'Test Book',
      authors: 'Jane Doe',
      isbn: null,
    });
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/search.json?'))).toBe(true);
    expect(urls.some((u) => u.includes('title=Test%20Book'))).toBe(true);
    expect(urls.some((u) => u.includes('author=Jane%20Doe'))).toBe(true);
  });

  it('prefetches ISBN JSON when isbn is set', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/isbn/9780306406157.json')) {
          return new Response(
            JSON.stringify({
              title: 'Via ISBN',
              authors: [{ name: 'Poe' }],
              covers: [888],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ docs: [] }), { status: 200 });
      });
    const p = createOpenLibraryProvider();
    const list = await p.searchCoverCandidates({
      title: 'Fallback',
      authors: 'Other',
      isbn: '978-0-306-40615-7',
    });
    expect(
      fetchMock.mock.calls.some((c) =>
        String(c[0]).includes('openlibrary.org/isbn/9780306406157.json'),
      ),
    ).toBe(true);
    expect(list[0]).toMatchObject({
      provider: 'openlibrary',
      providerId: 'id:888',
      title: 'Via ISBN',
      authors: 'Poe',
      thumbnailUrl:
        'https://covers.openlibrary.org/b/id/888-M.jpg?default=false',
    });
  });

  it('maps search doc with cover_i to candidate', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/search.json')) {
        return new Response(
          JSON.stringify({
            docs: [
              {
                cover_i: 12345,
                title: 'Found',
                author_name: ['A', 'B'],
                first_publish_year: 2001,
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    });
    const p = createOpenLibraryProvider();
    const list = await p.searchCoverCandidates({
      title: 'x',
      authors: 'y',
    });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      provider: 'openlibrary',
      providerId: 'id:12345',
      title: 'Found',
      authors: 'A, B',
      year: 2001,
      thumbnailUrl:
        'https://covers.openlibrary.org/b/id/12345-M.jpg?default=false',
    });
  });

  it('fetchCoverBytes rejects bodies under 500 bytes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Buffer.alloc(100), { status: 200 }),
    );
    const p = createOpenLibraryProvider();
    const buf = await p.fetchCoverBytes({
      provider: 'openlibrary',
      providerId: 'id:99',
      title: '',
      authors: '',
    });
    expect(buf).toBeNull();
  });

  it('searchIsbnCandidates maps OL isbn array via pickPrimaryIsbnFromList', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          docs: [
            {
              key: '/works/OL1W',
              title: 'T',
              author_name: ['Auth'],
              first_publish_year: 1999,
              isbn: ['9780306406157', '080442957X'],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const p = createOpenLibraryProvider();
    const list = await p.searchIsbnCandidates({ title: 'a', authors: 'b' });
    expect(list).toHaveLength(1);
    expect(list[0].isbn).toBe('9780306406157');
    expect(list[0].providerId).toBe('/works/OL1W');
  });
});
