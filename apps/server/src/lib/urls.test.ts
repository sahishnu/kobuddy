import { describe, expect, it } from 'vitest';
import { bookCoverUrl } from './urls.js';

describe('bookCoverUrl', () => {
  it('returns null when coverPath is missing', () => {
    expect(bookCoverUrl('abc', null)).toBeNull();
    expect(bookCoverUrl('abc', undefined)).toBeNull();
  });

  it('returns API path when coverPath is set', () => {
    expect(bookCoverUrl('abc', 'covers/abc.jpg')).toBe('/api/books/abc/cover');
  });
});
