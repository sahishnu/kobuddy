import { Link } from '@tanstack/react-router';
import { BookCoverThumb } from '@/components/BookCoverThumb';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BentoCard } from './BentoCard';

export type ShelfBook = {
  md5: string;
  coverUrl: string | null;
};

type Props = {
  books: ShelfBook[];
  className?: string;
};

export function BookshelfRow({ books, className }: Props) {
  return (
    <BentoCard
      title="Recent shelf"
      className={cn('h-full min-h-[20rem] md:min-h-0', className)}
      contentClassName="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-4">
        <div
          className={cn(
            'flex min-h-0 w-full min-w-0 gap-4 pb-1',
            'flex-wrap content-start justify-start',
            'md:flex-nowrap md:overflow-x-auto md:[scrollbar-color:var(--border)_transparent] md:[scrollbar-width:thin]',
          )}
        >
          {books.length === 0 ? (
            <p className="text-sm text-muted-foreground">No books yet.</p>
          ) : (
            books.map((b) => (
              <BookCoverThumb
                key={b.md5}
                variant="shelf"
                coverUrl={b.coverUrl}
                className="shadow-md ring-white/15"
              />
            ))
          )}
        </div>
        <Link
          to="/books"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'w-full shrink-0',
          )}
        >
          All books
        </Link>
      </div>
    </BentoCard>
  );
}
