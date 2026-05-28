import { Dialog } from '@base-ui/react/dialog';
import type { BookListItem } from '@kobuddy/common';
import { Link } from '@tanstack/react-router';
import { EyeOff, Pencil, Search, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthUi } from '@/auth-ui';
import { AdminBookEditDialog } from '@/components/AdminBookEditDialog';
import { AdminPreferencesDialog } from '@/components/AdminPreferencesDialog';
import { BookCoverThumb } from '@/components/BookCoverThumb';
import { BooksPagination } from '@/components/BooksPagination';
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
import { BOOKS_LIST_PAGE_SIZE, useAdminBooksPage, useMe } from '@/lib/hooks';
import { useDebouncedValue } from '@/lib/use-debounced-value';
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
  const search = useDebouncedValue(filter.trim(), 300);
  const [page, setPage] = useState(1);
  const [hiddenPage, setHiddenPage] = useState(1);
  const [selectedBook, setSelectedBook] = useState<BookListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hiddenListOpen, setHiddenListOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const me = useMe();
  const isAdmin = Boolean(me.data?.isAdmin);

  useEffect(() => {
    void search;
    setPage(1);
  }, [search]);

  const booksPage = useAdminBooksPage(isAdmin, {
    page,
    q: search || undefined,
  });
  const hiddenBooksPage = useAdminBooksPage(isAdmin && hiddenListOpen, {
    page: hiddenPage,
    hiddenOnly: true,
  });

  const hiddenCountQuery = useAdminBooksPage(isAdmin, {
    page: 1,
    pageSize: 1,
    hiddenOnly: true,
  });

  const rows = booksPage.data?.items ?? [];
  const total = booksPage.data?.total ?? 0;
  const pageSize = booksPage.data?.pageSize ?? BOOKS_LIST_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const hiddenRows = hiddenBooksPage.data?.items ?? [];
  const hiddenTotal = hiddenBooksPage.data?.total ?? 0;
  const hiddenCount = hiddenCountQuery.data?.total ?? 0;
  const hiddenPageSize = hiddenBooksPage.data?.pageSize ?? BOOKS_LIST_PAGE_SIZE;
  const hiddenPageCount = Math.max(1, Math.ceil(hiddenTotal / hiddenPageSize));

  useEffect(() => {
    if (hiddenPage > hiddenPageCount) setHiddenPage(hiddenPageCount);
  }, [hiddenPage, hiddenPageCount]);

  const openEditor = (book: BookListItem) => {
    setSelectedBook(book);
    setDialogOpen(true);
  };

  const openEditorFromHiddenList = (book: BookListItem) => {
    setHiddenListOpen(false);
    openEditor(book);
  };

  if (me.isLoading) {
    return <PageSpinner />;
  }

  if (!isAdmin) {
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

  if (booksPage.isLoading && !booksPage.data) {
    return <PageSpinner />;
  }

  if (booksPage.isError) {
    return <PageError error={booksPage.error} />;
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
            onClick={() => {
              setHiddenPage(1);
              setHiddenListOpen(true);
            }}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground/90 transition-colors hover:text-foreground"
            aria-haspopup="dialog"
          >
            <EyeOff className="size-3.5 shrink-0 opacity-70" aria-hidden />
            Hidden books
            <span className="tabular-nums opacity-80">({hiddenCount})</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPreferencesOpen(true)}
            aria-haspopup="dialog"
          >
            <Settings className="size-3.5 opacity-80" aria-hidden />
            Preferences
          </Button>
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

      <AdminPreferencesDialog
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
      />

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

      <BooksPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      />

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
          {booksPage.isFetching && rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-sm">
                Loading…
              </TableCell>
            </TableRow>
          ) : (
            rows.map((b, i) => (
              <TableRow
                key={b.md5}
                className={cn(i % 2 === 1 && 'bg-muted/40')}
              >
                <TableCell className="w-[72px] align-top">
                  <BookCoverThumb
                    coverUrl={b.coverUrl}
                    displayTitle={b.displayTitle}
                  />
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
                    onClick={() => openEditor(b)}
                  >
                    <Pencil className="size-3.5 opacity-80" aria-hidden />
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {rows.length === 0 && !booksPage.isFetching ? (
        <p className="text-center text-sm text-muted-foreground">
          {search ? 'No books match this search.' : 'No books in the library.'}
        </p>
      ) : null}

      <BooksPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      />

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
                {hiddenBooksPage.isLoading && hiddenRows.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                    Loading…
                  </p>
                ) : hiddenTotal === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                    No hidden books.
                  </p>
                ) : (
                  <>
                    <BooksPagination
                      className="mb-3 px-1"
                      page={hiddenPage}
                      pageSize={
                        hiddenBooksPage.data?.pageSize ?? BOOKS_LIST_PAGE_SIZE
                      }
                      total={hiddenTotal}
                      onPageChange={setHiddenPage}
                    />
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
                              <BookCoverThumb
                                coverUrl={b.coverUrl}
                                displayTitle={b.displayTitle}
                              />
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
                                onClick={() => openEditorFromHiddenList(b)}
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
                  </>
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
