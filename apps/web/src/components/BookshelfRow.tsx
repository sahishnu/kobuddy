import { Link } from '@tanstack/react-router';
import { BookCoverThumb } from '@/components/BookCoverThumb';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BentoCard } from './BentoCard';

export type ShelfBook = {
  md5: string;
  displayTitle: string;
  coverUrl: string | null;
  totalReadTime: number;
  percentComplete: number;
  completed: boolean;
};

type Props = {
  books: ShelfBook[];
  className?: string;
};

export function BookshelfRow({ books, className }: Props) {
  return (
    <BentoCard
      title="Recent Reads"
      action={
        <Link
          to="/books"
          className="text-[11px] font-medium tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          All books →
        </Link>
      }
      className={cn('h-full min-h-[20rem] md:min-h-0', className)}
      contentClassName="flex min-h-0 flex-1 flex-col"
    >
      <div
        className={cn(
          'flex min-h-0 w-full min-w-0 flex-1 gap-4',
          'flex-wrap content-start justify-start',
          'md:flex-nowrap md:overflow-x-auto md:[scrollbar-color:var(--border)_transparent] md:[scrollbar-width:thin]',
        )}
      >
        {books.length === 0 ? (
          <p className="text-sm text-muted-foreground">No books yet.</p>
        ) : (
          books.map((b) => (
            <div key={b.md5} className="flex flex-col items-center gap-1.5">
              <BookCoverThumb
                variant="shelf"
                coverUrl={b.coverUrl}
                displayTitle={b.displayTitle}
                className="flex-1 shadow-md ring-white/15"
              />
              {(b.totalReadTime > 0 ||
                b.percentComplete > 0 ||
                b.completed) && (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {b.totalReadTime > 0 &&
                    `${formatDuration(b.totalReadTime)} read`}
                  {b.totalReadTime > 0 &&
                    (b.percentComplete > 0 || b.completed) &&
                    ' · '}
                  {b.completed
                    ? 'Complete'
                    : b.percentComplete > 0 && `${b.percentComplete}%`}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </BentoCard>
  );
}
