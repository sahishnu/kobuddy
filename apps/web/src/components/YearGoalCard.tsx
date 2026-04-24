import type * as React from 'react';

import { cn } from '@/lib/utils';
import { BentoCard } from './BentoCard';

type Props = {
  booksFinishedThisLocalYear: number;
  readingGoalBooksPerYear: number | null;
  yearLabel: number;
  className?: string;
};

function GoalRing({
  pct,
  size = 120,
  stroke = 10,
  label,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  label: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, pct) / 100);
  const half = size / 2;

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-90 text-muted/50"
        role="img"
        aria-label="Year reading goal progress"
      >
        <title>Year reading goal progress</title>
        <circle
          cx={half}
          cy={half}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
        />
        <circle
          cx={half}
          cy={half}
          r={r}
          fill="none"
          stroke="var(--color-reading)"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            strokeDasharray: c,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {label}
      </div>
    </div>
  );
}

export function YearGoalCard({
  booksFinishedThisLocalYear,
  readingGoalBooksPerYear,
  yearLabel,
  className,
}: Props) {
  const goal = readingGoalBooksPerYear;
  const pct =
    goal != null && goal > 0
      ? Math.min(100, Math.round((booksFinishedThisLocalYear / goal) * 100))
      : 0;

  return (
    <BentoCard
      title={`Books · ${yearLabel}`}
      className={cn('h-full', className)}
    >
      <div className="flex flex-col items-center gap-4">
        {goal != null ? (
          <>
            <GoalRing
              pct={pct}
              label={
                <span className="text-center text-xs font-semibold tabular-nums">
                  {pct}%
                </span>
              }
            />
            <p className="inline-flex items-baseline justify-center gap-1.5 text-center text-sm text-muted-foreground">
              <span className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {booksFinishedThisLocalYear}
              </span>
              <span>of {goal} books finished</span>
            </p>
          </>
        ) : (
          <>
            <p className="font-heading text-3xl tracking-tight">
              {booksFinishedThisLocalYear}
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Books finished this year. Set{' '}
              <span className="font-medium text-foreground">
                READING_GOAL_BOOKS
              </span>{' '}
              for a ring target.
            </p>
          </>
        )}
      </div>
    </BentoCard>
  );
}
