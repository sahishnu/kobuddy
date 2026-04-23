import { Dialog } from '@base-ui/react/dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Barcode, ImageIcon, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { ApiError, apiJson } from '@/api';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { BookListRow } from '@/pages/BooksPage';

type CoverCandidate = {
  provider: 'openlibrary' | 'googlebooks';
  providerId: string;
  title: string;
  authors: string;
  year?: number;
  thumbnailUrl?: string;
};

type IsbnCandidate = {
  provider: 'openlibrary' | 'googlebooks';
  providerId: string;
  title: string;
  authors: string;
  year?: number;
  isbn: string;
};

type AdminBookEditDialogProps = {
  book: BookListRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t.length ? t : null;
}

function toastIsbnAutoError(err: unknown) {
  const msg = err instanceof ApiError ? err.message : String(err);
  if (msg === 'No ISBN found') {
    toast.message('No ISBN found', {
      description:
        'Nothing turned up for this title and author. Try “Browse ISBN matches” with a different search, or enter an ISBN manually.',
    });
    return;
  }
  if (msg === 'Invalid ISBN') {
    toast.error('Invalid ISBN', {
      description: 'Use 10 or 13 digits (ISBN-10 may end with X).',
    });
    return;
  }
  toast.error('Could not set ISBN', { description: msg });
}

export function AdminBookEditDialog({
  book,
  open,
  onOpenChange,
}: AdminBookEditDialogProps) {
  const queryClient = useQueryClient();
  const baseId = useId();
  const [customTitle, setCustomTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [isbn, setIsbn] = useState('');
  const [hidden, setHidden] = useState(false);
  const [coverNonce, setCoverNonce] = useState(0);
  const [coverBroken, setCoverBroken] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [showCandidates, setShowCandidates] = useState(false);
  const [isbnMatchQuery, setIsbnMatchQuery] = useState('');
  const [showIsbnCandidates, setShowIsbnCandidates] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset form state only when switching to a different book (identified by md5)
  useEffect(() => {
    if (!book) return;
    setCustomTitle(book.customTitle ?? '');
    setAuthors(book.authors ?? '');
    setIsbn(book.isbn ?? '');
    setHidden(book.hidden);
    setCandidateQuery(book.displayTitle);
    setShowCandidates(false);
    setIsbnMatchQuery(book.displayTitle);
    setShowIsbnCandidates(false);
    setCoverBroken(false);
    setCoverNonce((n) => n + 1);
  }, [book?.md5]);

  const md5 = book?.md5 ?? '';
  const coverSrc =
    md5.length > 0 ? `/api/books/${md5}/cover?v=${coverNonce}` : '';

  const invalidateBooks = () => {
    void queryClient.invalidateQueries({ queryKey: ['books'] });
  };

  const saveMeta = useMutation({
    mutationFn: async () => {
      await apiJson<{ ok: boolean }>(`/api/books/${md5}`, {
        method: 'PUT',
        body: JSON.stringify({
          customTitle: emptyToNull(customTitle),
          authors: emptyToNull(authors),
          isbn: emptyToNull(isbn),
        }),
      });
      if (book && hidden !== book.hidden) {
        await apiJson<{ ok: boolean }>(`/api/books/${md5}/hide`, {
          method: 'PUT',
          body: JSON.stringify({ hidden }),
        });
      }
    },
    onSuccess: () => {
      invalidateBooks();
      onOpenChange(false);
    },
  });

  const autoCover = useMutation({
    mutationFn: () =>
      apiJson<{ ok: boolean }>(`/api/books/${md5}/cover/auto`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      setCoverBroken(false);
      setCoverNonce((n) => n + 1);
      invalidateBooks();
    },
  });

  const applyCandidate = useMutation({
    mutationFn: (c: CoverCandidate) =>
      apiJson<{ ok: boolean }>(`/api/books/${md5}/cover/auto`, {
        method: 'POST',
        body: JSON.stringify({
          provider: c.provider,
          providerId: c.providerId,
          ...(c.thumbnailUrl
            ? { thumbnailUrl: c.thumbnailUrl.replace('http:', 'https:') }
            : {}),
        }),
      }),
    onSuccess: () => {
      setCoverBroken(false);
      setCoverNonce((n) => n + 1);
      setShowCandidates(false);
      invalidateBooks();
    },
  });

  const removeCover = useMutation({
    mutationFn: () =>
      apiJson<{ ok: boolean }>(`/api/books/${md5}/cover`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      setCoverBroken(false);
      setCoverNonce((n) => n + 1);
      invalidateBooks();
    },
  });

  const uploadCover = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.set('file', file);
      return apiJson<{ ok: boolean }>(`/api/books/${md5}/cover`, {
        method: 'POST',
        body: fd,
      });
    },
    onSuccess: () => {
      setCoverBroken(false);
      setCoverNonce((n) => n + 1);
      invalidateBooks();
    },
  });

  const candidatesQ = useQuery({
    queryKey: ['book-cover-candidates', md5, candidateQuery],
    queryFn: () => {
      const q = new URLSearchParams();
      if (candidateQuery.trim()) q.set('q', candidateQuery.trim());
      const qs = q.toString();
      return apiJson<{ candidates: CoverCandidate[] }>(
        `/api/books/${md5}/cover/candidates${qs ? `?${qs}` : ''}`,
      );
    },
    enabled: open && Boolean(md5) && showCandidates,
  });

  const isbnCandidatesQ = useQuery({
    queryKey: ['book-isbn-candidates', md5, isbnMatchQuery],
    queryFn: () => {
      const q = new URLSearchParams();
      if (isbnMatchQuery.trim()) q.set('q', isbnMatchQuery.trim());
      const qs = q.toString();
      return apiJson<{ candidates: IsbnCandidate[] }>(
        `/api/books/${md5}/isbn/candidates${qs ? `?${qs}` : ''}`,
      );
    },
    enabled: open && Boolean(md5) && showIsbnCandidates,
  });

  const autoIsbn = useMutation({
    mutationFn: () =>
      apiJson<{ ok: boolean; isbn: string }>(`/api/books/${md5}/isbn/auto`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      setIsbn(data.isbn);
      invalidateBooks();
      setCoverBroken(false);
      setCoverNonce((n) => n + 1);
    },
    onError: (err) => toastIsbnAutoError(err),
  });

  const applyIsbnCandidate = useMutation({
    mutationFn: (isbnValue: string) =>
      apiJson<{ ok: boolean; isbn: string }>(`/api/books/${md5}/isbn/auto`, {
        method: 'POST',
        body: JSON.stringify({ isbn: isbnValue }),
      }),
    onSuccess: (data) => {
      setIsbn(data.isbn);
      setShowIsbnCandidates(false);
      invalidateBooks();
      setCoverBroken(false);
      setCoverNonce((n) => n + 1);
    },
    onError: (err) => toastIsbnAutoError(err),
  });

  const busy =
    saveMeta.isPending ||
    autoCover.isPending ||
    applyCandidate.isPending ||
    removeCover.isPending ||
    uploadCover.isPending ||
    autoIsbn.isPending ||
    applyIsbnCandidate.isPending;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            'fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px]',
            'transition-opacity duration-200',
            'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
          )}
        />
        <Dialog.Viewport className="fixed inset-0 z-[70] grid place-items-center p-4">
          <Dialog.Popup
            className={cn(
              'flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-lg',
              'ring-1 ring-foreground/[0.07] dark:ring-white/[0.04]',
              'outline-none transition-transform duration-200',
              'data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0',
              'data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0',
            )}
          >
            <div className="shrink-0 border-b border-border/60 px-5 py-4">
              <Dialog.Title className="font-heading text-lg font-semibold tracking-tight">
                Edit book
              </Dialog.Title>
              {book ? (
                <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
                  {book.md5}
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!book ? (
                <p className="text-sm text-muted-foreground">
                  No book selected.
                </p>
              ) : (
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="relative flex h-36 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-white/10">
                      {!coverBroken ? (
                        <img
                          src={coverSrc}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={() => setCoverBroken(true)}
                          onLoad={() => setCoverBroken(false)}
                        />
                      ) : (
                        <span className="px-2 text-center text-[11px] text-muted-foreground">
                          No cover
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-medium leading-snug">
                        {book.displayTitle}
                      </p>
                      {book.coverSource ? (
                        <p className="text-xs text-muted-foreground">
                          Cover: {book.coverSource}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No cover file
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={busy}
                          onClick={() => autoCover.mutate()}
                        >
                          {autoCover.isPending ? (
                            <Spinner className="size-3.5 opacity-80" />
                          ) : (
                            <Wand2
                              className="size-3.5 opacity-80"
                              aria-hidden
                            />
                          )}
                          Auto cover
                        </Button>
                        <label
                          className={cn(
                            buttonVariants({ variant: 'outline', size: 'sm' }),
                            'cursor-pointer gap-1.5',
                            busy && 'pointer-events-none opacity-50',
                          )}
                        >
                          {uploadCover.isPending ? (
                            <Spinner className="size-3.5 opacity-80" />
                          ) : (
                            <ImageIcon
                              className="size-3.5 opacity-80"
                              aria-hidden
                            />
                          )}
                          Upload
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={busy}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (f) uploadCover.mutate(f);
                            }}
                          />
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          disabled={busy}
                          onClick={() => removeCover.mutate()}
                        >
                          {removeCover.isPending ? (
                            <Spinner className="size-3.5 opacity-80" />
                          ) : (
                            <Trash2
                              className="size-3.5 opacity-80"
                              aria-hidden
                            />
                          )}
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Cover search</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setShowCandidates((s) => !s)}
                      >
                        {showCandidates ? 'Hide results' : 'Browse matches'}
                      </Button>
                    </div>
                    {showCandidates ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="Search title (optional)"
                          value={candidateQuery}
                          onChange={(e) => setCandidateQuery(e.target.value)}
                        />
                        {candidatesQ.isLoading ? (
                          <div className="flex justify-center py-6">
                            <Spinner className="size-5 text-muted-foreground" />
                          </div>
                        ) : candidatesQ.isError ? (
                          <p className="text-sm text-destructive">
                            {(candidatesQ.error as Error).message}
                          </p>
                        ) : (
                          <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                            {(candidatesQ.data?.candidates ?? []).map((c) => (
                              <button
                                key={`${c.provider}:${c.providerId}`}
                                type="button"
                                disabled={applyCandidate.isPending}
                                onClick={() => applyCandidate.mutate(c)}
                                className={cn(
                                  'group relative aspect-[2/3] overflow-hidden rounded-md bg-muted ring-1 ring-white/10',
                                  'transition hover:ring-reading/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-reading',
                                )}
                                title={`${c.title} — ${c.authors}`}
                              >
                                {c.thumbnailUrl ? (
                                  <img
                                    src={c.thumbnailUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="flex h-full items-center justify-center p-1 text-center text-[10px] text-muted-foreground">
                                    No thumb
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`${baseId}-custom`}>
                        Display title override
                      </Label>
                      <Input
                        id={`${baseId}-custom`}
                        placeholder={book.title ?? 'Custom title'}
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        KOReader title: {book.title ?? '—'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${baseId}-authors`}>Authors</Label>
                      <Input
                        id={`${baseId}-authors`}
                        value={authors}
                        onChange={(e) => setAuthors(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${baseId}-isbn`}>ISBN</Label>
                      <Input
                        id={`${baseId}-isbn`}
                        inputMode="numeric"
                        value={isbn}
                        onChange={(e) => setIsbn(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use Auto or Browse to fill from Open Library / Google
                        Books. A new ISBN can auto-fetch a cover unless you
                        uploaded one manually.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={busy}
                          onClick={() => autoIsbn.mutate()}
                        >
                          {autoIsbn.isPending ? (
                            <Spinner className="size-3.5 opacity-80" />
                          ) : (
                            <Wand2
                              className="size-3.5 opacity-80"
                              aria-hidden
                            />
                          )}
                          Auto ISBN
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => setShowIsbnCandidates((s) => !s)}
                        >
                          <Barcode
                            className="size-3.5 opacity-80"
                            aria-hidden
                          />
                          {showIsbnCandidates
                            ? 'Hide ISBN matches'
                            : 'Browse ISBN matches'}
                        </Button>
                      </div>
                      {showIsbnCandidates ? (
                        <div className="space-y-2 pt-1">
                          <Input
                            placeholder="Search title (optional)"
                            value={isbnMatchQuery}
                            onChange={(e) => setIsbnMatchQuery(e.target.value)}
                          />
                          {isbnCandidatesQ.isLoading ? (
                            <div className="flex justify-center py-4">
                              <Spinner className="size-5 text-muted-foreground" />
                            </div>
                          ) : isbnCandidatesQ.isError ? (
                            <p className="text-sm text-destructive">
                              {(isbnCandidatesQ.error as Error).message}
                            </p>
                          ) : (isbnCandidatesQ.data?.candidates ?? [])
                              .length === 0 ? (
                            <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
                              No ISBN matches for this search. Adjust the title
                              above or enter an ISBN manually.
                            </p>
                          ) : (
                            <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-muted/30 p-1.5">
                              {(isbnCandidatesQ.data?.candidates ?? []).map(
                                (c) => (
                                  <li key={`${c.provider}:${c.isbn}`}>
                                    <button
                                      type="button"
                                      disabled={applyIsbnCandidate.isPending}
                                      onClick={() =>
                                        applyIsbnCandidate.mutate(c.isbn)
                                      }
                                      className={cn(
                                        'flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left text-sm',
                                        'transition hover:bg-muted hover:text-foreground',
                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-reading',
                                      )}
                                    >
                                      <span className="font-mono text-xs tracking-tight">
                                        {c.isbn}
                                      </span>
                                      <span className="line-clamp-2 text-xs text-muted-foreground">
                                        {c.title}
                                        {c.authors ? ` — ${c.authors}` : ''}
                                      </span>
                                    </button>
                                  </li>
                                ),
                              )}
                            </ul>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border border-input"
                        checked={hidden}
                        onChange={(e) => setHidden(e.target.checked)}
                      />
                      Hidden from library and stats lists
                    </label>
                  </div>

                  {saveMeta.isError ||
                  autoCover.isError ||
                  applyCandidate.isError ||
                  removeCover.isError ||
                  uploadCover.isError ? (
                    <p className="text-sm text-destructive">
                      {
                        (
                          (saveMeta.error ??
                            autoCover.error ??
                            applyCandidate.error ??
                            removeCover.error ??
                            uploadCover.error) as Error
                        ).message
                      }
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/60 px-5 py-4 sm:flex-row sm:justify-end">
              <Dialog.Close
                type="button"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'w-full sm:w-auto',
                )}
              >
                Close
              </Dialog.Close>
              <Button
                type="button"
                size="sm"
                className="w-full gap-2 sm:w-auto"
                disabled={!book || saveMeta.isPending}
                onClick={() => saveMeta.mutate()}
              >
                {saveMeta.isPending ? (
                  <>
                    <Spinner className="size-4 opacity-80" />
                    Saving…
                  </>
                ) : (
                  'Save metadata'
                )}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
