import { Link } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BookCoverThumb } from '@/components/BookCoverThumb';
import { BooksPagination } from '@/components/BooksPagination';
import { PageError } from '@/components/PageError';
import { PageSpinner } from '@/components/PageSpinner';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BOOKS_LIST_PAGE_SIZE, useBooksPage } from '@/lib/hooks';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

export function BooksPage() {
  const [filter, setFilter] = useState('');
  const search = useDebouncedValue(filter.trim(), 300);
  const [page, setPage] = useState(1);

  useEffect(() => {
    void search;
    setPage(1);
  }, [search]);

  const booksPage = useBooksPage({
    page,
    q: search || undefined,
    sort: 'lastOpen',
  });
  const rows = booksPage.data?.items ?? [];
  const total = booksPage.data?.total ?? 0;
  const pageSize = booksPage.data?.pageSize ?? BOOKS_LIST_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  if (booksPage.isLoading && !booksPage.data) {
    return <PageSpinner />;
  }

  if (booksPage.isError) {
    return <PageError error={booksPage.error} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pb-12 md:p-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Library
        </h1>
        <Link
          to="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Dashboard
        </Link>
      </header>

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          placeholder="Search title, author, ISBN…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9"
          aria-label="Search books"
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
            <TableHead className="min-w-0 w-[46%] sm:w-[50%]">Title</TableHead>
            <TableHead className="min-w-0">Authors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {booksPage.isFetching && rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-10 text-center text-sm">
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
                <TableCell
                  className="min-w-0 max-w-0 truncate font-medium"
                  title={b.displayTitle}
                >
                  {b.displayTitle}
                </TableCell>
                <TableCell
                  className="min-w-0 max-w-0 truncate text-muted-foreground"
                  title={b.authors ?? undefined}
                >
                  {b.authors ?? '—'}
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
    </div>
  );
}
