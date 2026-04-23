import { BentoCard } from './BentoCard';

function formatLifetimeReadingTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

type Props = {
  totalReadingTimeSeconds: number;
  totalPagesRead: number;
  totalBooks: number;
};

export function LifetimeStatsBento({
  totalReadingTimeSeconds,
  totalPagesRead,
  totalBooks,
}: Props) {
  return (
    <BentoCard title="Lifetime">
      <div className="flex min-w-0 flex-wrap gap-x-10 gap-y-6">
        <div className="min-w-[8rem] space-y-1">
          <p className="text-sm text-muted-foreground">Reading time</p>
          <p className="font-heading text-2xl tracking-tight md:text-3xl">
            {formatLifetimeReadingTime(totalReadingTimeSeconds)}
          </p>
        </div>
        <div className="min-w-[8rem] space-y-1">
          <p className="text-sm text-muted-foreground">Pages read</p>
          <p className="font-heading text-2xl tracking-tight md:text-3xl">
            {totalPagesRead.toLocaleString()}
          </p>
        </div>
        <div className="min-w-[8rem] space-y-1">
          <p className="text-sm text-muted-foreground">Books</p>
          <p className="font-heading text-2xl tracking-tight md:text-3xl">
            {totalBooks.toLocaleString()}
          </p>
        </div>
      </div>
    </BentoCard>
  );
}
