/** Public URL for a book cover image, or null when no cover is stored. */
export function bookCoverUrl(
  md5: string,
  coverPath: string | null | undefined,
): string | null {
  return coverPath ? `/api/books/${md5}/cover` : null;
}
