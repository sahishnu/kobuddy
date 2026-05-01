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
