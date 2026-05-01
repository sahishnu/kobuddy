import type { BookListItem } from '@kobuddy/common';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { BookCoverThumb } from '@/components/BookCoverThumb';
import { PageError } from '@/components/PageError';
import { PageSpinner } from '@/components/PageSpinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { apiJson } from '../api';

export function BooksPage() {
  const books = useQuery({
    queryKey: ['books', 'all'],
    queryFn: () => apiJson<BookListItem[]>('/api/books'),
  });

  if (books.isLoading) {
    return <PageSpinner />;
  }

  if (books.isError) {
    return <PageError error={books.error} />;
  }

  const rows = books.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 pb-12 md:p-6">
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

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[72px]" />
            <TableHead className="min-w-0 w-[46%] sm:w-[50%]">Title</TableHead>
            <TableHead className="min-w-0">Authors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b, i) => (
            <TableRow key={b.md5} className={cn(i % 2 === 1 && 'bg-muted/40')}>
              <TableCell className="w-[72px] align-top">
                <BookCoverThumb coverUrl={b.coverUrl} />
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
