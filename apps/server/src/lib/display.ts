export function displayTitle(b: {
  customTitle: string | null;
  title: string | null;
}) {
  return b.customTitle || b.title || '(untitled)';
}
