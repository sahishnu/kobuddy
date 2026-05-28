import { Dialog } from '@base-ui/react/dialog';
import { Link } from '@tanstack/react-router';
import { EyeOff, Pencil, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuthUi } from '@/auth-ui';
import { AdminBookEditDialog } from '@/components/AdminBookEditDialog';
import { BookCoverThumb } from '@/components/BookCoverThumb';
import { PageError } from '@/components/PageError';
import { PageSpinner } from '@/components/PageSpinner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DIALOG_BACKDROP_CLASS, DIALOG_POPUP_CLASS } from '@/lib/dialog-styles';
import { formatDuration } from '@/lib/format';
import { useAdminBooksList, useMe } from '@/lib/hooks';
import { cn } from '@/lib/utils';

function formatLastOpen(epoch: number | null): string {
  if (!epoch) return '—';
  const d = new Date(epoch * 1000);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AdminBooksPage() {
  const { openLoginModal } = useAuthUi();
  const [filter, setFilter] = useState('');
  const [selectedMd5, setSelectedMd5] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hiddenListOpen, setHiddenListOpen] = useState(false);

  const me = useMe();

  const allBooks = useAdminBooksList(Boolean(me.data?.isAdmin));

  const rows = useMemo(
    () => (allBooks.data ?? []).filter((b) => !b.hidden),
    [allBooks.data],
  );
  const hiddenRows = useMemo(
    () => (allBooks.data ?? []).filter((b) => b.hidden),
    [allBooks.data],
  );
  const needle = filter.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!needle) return rows;
    return rows.filter((b) => {
      const hay = [
        b.displayTitle,
        b.authors,
        b.md5,
        b.isbn,
        b.title,
        b.customTitle,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, needle]);

  const selectedBook = useMemo(
    () =>
      selectedMd5
        ? ((allBooks.data ?? []).find((b) => b.md5 === selectedMd5) ?? null)
        : null,
    [allBooks.data, selectedMd5],
  );

  const openEditor = (md5: string) => {
    setSelectedMd5(md5);
    setDialogOpen(true);
  };

  const openEditorFromHiddenList = (md5: string) => {
    setHiddenListOpen(false);
    openEditor(md5);
  };

  if (me.isLoading) {
    return <PageSpinner />;
  }

  if (!me.data?.isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-6 p-6">
        <header>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Library admin
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your admin password to edit book metadata and covers.
          </p>
        </header>
        <Button type="button" onClick={() => openLoginModal()}>
          Admin login
        </Button>
        <p>
          <Link
            to="/"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Dashboard
          </Link>
        </p>
      </div>
    );
  }

  if (allBooks.isLoading) {
    return <PageSpinner />;
  }

  if (allBooks.isError) {
    return <PageError error={allBooks.error} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-12 md:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Library admin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Covers, titles, authors, ISBN, and visibility.
          </p>
          <button
            type="button"
            onClick={() => setHiddenListOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground/90 transition-colors hover:text-foreground"
            aria-haspopup="dialog"
          >
            <EyeOff className="size-3.5 shrink-0 opacity-70" aria-hidden />
            Hidden books
            {allBooks.isSuccess ? (
              <span className="tabular-nums opacity-80">
                ({hiddenRows.length})
              </span>
            ) : null}
          </button>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            to="/"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Dashboard
          </Link>
          <Link
            to="/books"
            className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Library
          </Link>
        </div>
      </header>

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          placeholder="Search title, author, ISBN, md5…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9"
          aria-label="Filter books"
        />
      </div>

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[72px]" />
            <TableHead className="min-w-0 w-[30%]">Title</TableHead>
            <TableHead className="hidden min-w-0 sm:table-cell sm:w-[22%]">
              Authors
            </TableHead>
            <TableHead className="min-w-0 w-[100px] text-right">
              Pages
            </TableHead>
            <TableHead className="hidden min-w-0 sm:table-cell sm:w-[90px] text-right">
              Read Time
            </TableHead>
            <TableHead className="hidden min-w-0 md:table-cell md:w-[110px] text-right">
              Last Open
            </TableHead>
            <TableHead className="w-[88px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((b, i) => (
            <TableRow key={b.md5} className={cn(i % 2 === 1 && 'bg-muted/40')}>
              <TableCell className="w-[72px] align-top">
                <BookCoverThumb coverUrl={b.coverUrl} />
              </TableCell>
              <TableCell className="min-w-0 max-w-0 align-top">
                <div
                  className="truncate font-medium leading-snug"
                  title={b.displayTitle}
                >
                  {b.displayTitle}
                </div>
                <div
                  className="mt-1 truncate text-xs text-muted-foreground sm:hidden"
                  title={b.authors ?? undefined}
                >
                  {b.authors ?? '—'}
                </div>
              </TableCell>
              <TableCell
                className="hidden min-w-0 max-w-0 truncate text-muted-foreground sm:table-cell"
                title={b.authors ?? undefined}
              >
                {b.authors ?? '—'}
              </TableCell>
              <TableCell className="w-[120px]">
                <div className="flex flex-col items-end gap-1.5">
                  <span className="tabular-nums text-sm text-muted-foreground">
                    {b.totalReadPages} / {b.pages}
                  </span>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${b.pages > 0 ? Math.min(100, Math.round((b.totalReadPages / b.pages) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden tabular-nums text-right text-sm text-muted-foreground sm:table-cell">
                {b.totalReadTime > 0 ? formatDuration(b.totalReadTime) : '—'}
              </TableCell>
              <TableCell className="hidden text-right text-sm text-muted-foreground md:table-cell">
                {formatLastOpen(b.lastOpen)}
              </TableCell>
              <TableCell className="w-[88px] text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openEditor(b.md5)}
                >
                  <Pencil className="size-3.5 opacity-80" aria-hidden />
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          No books match this filter.
        </p>
      ) : null}

      <AdminBookEditDialog
        book={selectedBook}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <Dialog.Root open={hiddenListOpen} onOpenChange={setHiddenListOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className={cn(DIALOG_BACKDROP_CLASS, 'z-[60]')} />
          <Dialog.Viewport className="fixed inset-0 z-[60] grid place-items-center p-4">
            <Dialog.Popup
              className={cn(
                DIALOG_POPUP_CLASS,
                'z-[60] flex max-h-[min(85vh,640px)] max-w-lg flex-col overflow-hidden',
              )}
            >
              <div className="shrink-0 border-b border-border/60 px-5 py-4">
                <Dialog.Title className="font-heading text-lg font-semibold tracking-tight">
                  Hidden books
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Not shown on the public library or dashboard. Open one to edit
                  or unhide.
                </Dialog.Description>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
                {hiddenRows.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                    No hidden books.
                  </p>
                ) : (
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[72px]" />
                        <TableHead className="min-w-0">Title</TableHead>
                        <TableHead className="w-[72px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hiddenRows.map((b, i) => (
                        <TableRow
                          key={b.md5}
                          className={cn(i % 2 === 1 && 'bg-muted/40')}
                        >
                          <TableCell className="w-[72px] align-middle">
                            <BookCoverThumb coverUrl={b.coverUrl} />
                          </TableCell>
                          <TableCell className="min-w-0 max-w-0">
                            <div
                              className="truncate text-sm font-medium"
                              title={b.displayTitle}
                            >
                              {b.displayTitle}
                            </div>
                            <div
                              className="truncate text-xs text-muted-foreground"
                              title={b.authors ?? undefined}
                            >
                              {b.authors ?? '—'}
                            </div>
                          </TableCell>
                          <TableCell className="w-[72px] text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => openEditorFromHiddenList(b.md5)}
                            >
                              <Pencil
                                className="size-3 opacity-80"
                                aria-hidden
                              />
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <div className="shrink-0 border-t border-border/60 px-5 py-3">
                <Dialog.Close
                  type="button"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'w-full sm:w-auto',
                  )}
                >
                  Close
                </Dialog.Close>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
