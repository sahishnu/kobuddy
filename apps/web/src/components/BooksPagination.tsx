import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function BooksPagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <nav className={className} aria-label="Books pagination">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? (
            'No books'
          ) : (
            <>
              Showing{' '}
              <span className="tabular-nums text-foreground">
                {start}–{end}
              </span>{' '}
              of <span className="tabular-nums text-foreground">{total}</span>
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Previous
          </Button>
          <span className="min-w-[5.5rem] text-center text-sm tabular-nums text-muted-foreground">
            Page {safePage} / {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={safePage >= pageCount}
            onClick={() => onPageChange(safePage + 1)}
          >
            Next
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </nav>
  );
}
