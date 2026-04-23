import type { CurrentReadingBook } from '@kobuddy/common';
import { BookOpen } from 'lucide-react';
import { useState } from 'react';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { BentoCard } from './BentoCard';

type Props = {
  book: CurrentReadingBook | null;
  className?: string;
};

function CoverBlock({ book }: { book: CurrentReadingBook }) {
  const [failed, setFailed] = useState(false);
  const coverSrc = book.coverUrl?.trim() || `/api/books/${book.md5}/cover`;

  return (
    <div
      className={cn(
        'relative aspect-[2/3] w-[min(42vw,10.5rem)] shrink-0 overflow-hidden rounded-xl bg-muted',
        'shadow-lg ring-1 ring-black/10 dark:ring-white/10 sm:w-[11rem] md:w-[11.5rem]',
      )}
    >
      {!failed ? (
        <img
          src={coverSrc}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-2 px-2 text-center"
          aria-hidden
        >
          <BookOpen
            className="size-12 text-muted-foreground/50 sm:size-14"
            strokeWidth={1.25}
          />
          <span className="text-xs leading-snug text-muted-foreground">
            No cover
          </span>
        </div>
      )}
    </div>
  );
}

function pagesReadLine(book: CurrentReadingBook): string {
  const { totalReadPages, pages } = book;
  if (pages > 0) {
    return `${totalReadPages.toLocaleString()} of ${pages.toLocaleString()} pages read`;
  }
  return `${totalReadPages.toLocaleString()} pages read`;
}

export function CurrentBookCard({ book, className }: Props) {
  const pct =
    book && book.pages > 0
      ? Math.min(100, (book.totalReadPages / book.pages) * 100)
      : 0;

  return (
    <BentoCard
      title="Reading now"
      className={cn('h-full min-h-[16rem] md:min-h-0', className)}
      contentClassName="flex min-h-0 flex-1 flex-col"
    >
      {!book ? (
        <p className="flex flex-1 items-center text-sm text-muted-foreground">
          No in-progress book (every visible book is at the last page, or
          lengths are unknown).
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 gap-5 sm:gap-6">
          <CoverBlock key={book.md5} book={book} />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 pt-0.5">
            <div className="min-w-0 space-y-1.5">
              <h3 className="font-heading text-xl font-semibold leading-snug tracking-tight text-balance sm:text-2xl">
                {book.displayTitle}
              </h3>
              {book.authors ? (
                <p className="text-sm leading-snug text-muted-foreground line-clamp-3">
                  {book.authors}
                </p>
              ) : null}
              <p className="pt-0.5 text-sm tabular-nums text-foreground/90">
                {pagesReadLine(book)}
              </p>
            </div>
            <Progress
              value={pct}
              className="mt-auto w-full shrink-0 [&_[data-slot=progress-track]]:h-2.5 [&_[data-slot=progress-track]]:rounded-full [&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-indicator]]:bg-reading"
            />
          </div>
        </div>
      )}
    </BentoCard>
  );
}
