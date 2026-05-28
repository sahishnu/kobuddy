import { Letters } from '@kumailnanji/letters';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { AppFooterBentoSlot } from '@/components/AppFooter';
import { PageError } from '@/components/PageError';
import { PageSpinner } from '@/components/PageSpinner';
import { formatDuration } from '@/lib/format';
import { useHomeShelfBooks, useStatsOverview } from '@/lib/hooks';
import { BentoCard } from '../components/BentoCard';
import { BookshelfRow, type ShelfBook } from '../components/BookshelfRow';
import { CurrentBookCard } from '../components/CurrentBookCard';
import { HourlyReadingChart } from '../components/HourlyReadingChart';
import { ReadingHeatmap } from '../components/ReadingHeatmap';
import { StreakCard } from '../components/StreakCard';
import { WeekPagesCard } from '../components/WeekPagesCard';
import { YearGoalCard } from '../components/YearGoalCard';

const nookGradient = (id: string): ReactNode => (
  <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stopColor="oklch(0.65 0.18 35)" />
    <stop offset="50%" stopColor="oklch(0.62 0.16 15)" />
    <stop offset="100%" stopColor="oklch(0.55 0.12 280)" />
  </linearGradient>
);

export function HomePage() {
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    [],
  );

  const stats = useStatsOverview(timeZone);
  const shelf = useHomeShelfBooks();

  if (stats.isLoading) {
    return <PageSpinner />;
  }

  if (stats.isError) {
    return <PageError error={stats.error} />;
  }

  const s = stats.data;
  if (!s) return null;

  const shelfBooks: ShelfBook[] = (shelf.data ?? []).map((b) => ({
    md5: b.md5,
    coverUrl: b.coverUrl,
    totalReadTime: b.totalReadTime,
    percentComplete: Math.min(100, b.percentComplete),
    completed: b.completed,
  }));

  const yearLabel = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: s.statsTimeZone,
      year: 'numeric',
    }).format(new Date()),
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1200px] space-y-4 overflow-x-hidden p-4 pb-10 md:p-5">
      <div className="grid grid-cols-12 gap-2.5 md:gap-3">
        <div className="col-span-12 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-3">
          <BentoCard title="Reading Time">
            <p className="font-heading text-2xl tracking-tight md:text-3xl">
              {formatDuration(s.totalReadingTimeSeconds, {
                includeSeconds: true,
              })}
            </p>
            <p className="text-xs text-muted-foreground">Lifetime total</p>
          </BentoCard>
          <BentoCard title="Pages Read">
            <p className="font-heading text-2xl tracking-tight md:text-3xl">
              {s.totalPagesRead.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Lifetime total</p>
          </BentoCard>
          <BentoCard title="Books">
            <p className="font-heading text-2xl tracking-tight md:text-3xl">
              {s.totalBooks.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Lifetime total</p>
          </BentoCard>
          <div className="flex flex-col justify-end pb-0.5 sm:hidden">
            <div className="text-foreground text-center">
              <span className="sr-only">Welcome to Sahishnus nook</span>
              <p className="text-sm text-muted-foreground">Welcome to</p>
              <div aria-hidden className="flex flex-col items-center">
                <Letters
                  text="Sahishnus"
                  autoPlay
                  color="url(#nook-grad-sm-1)"
                  svgDefs={nookGradient('nook-grad-sm-1')}
                  className="h-11 w-auto"
                />
                <Letters
                  text="nook"
                  autoPlay
                  color="url(#nook-grad-sm-2)"
                  svgDefs={nookGradient('nook-grad-sm-2')}
                  className="h-11 w-auto"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:items-stretch md:grid-cols-12 md:gap-3 md:items-stretch">
          <div className="flex h-full min-h-0 min-w-0 flex-col sm:col-span-1 md:col-span-3">
            <YearGoalCard
              booksFinishedThisLocalYear={s.booksFinishedThisLocalYear}
              readingGoalBooksPerYear={s.readingGoalBooksPerYear}
              yearLabel={yearLabel}
              className="min-h-0 flex-1"
            />
          </div>
          <div className="flex h-full min-h-0 min-w-0 flex-col sm:col-span-1 md:col-span-3">
            <WeekPagesCard
              weekDailyReading={s.weekDailyReading}
              className="min-h-0 flex-1"
            />
          </div>
          <div className="hidden flex-col justify-end pb-0.5 sm:flex sm:col-span-2 md:col-span-3 md:justify-center md:pb-0">
            <div className="text-foreground text-center">
              <span className="sr-only">Welcome to Sahishnus nook</span>
              <p className="text-sm text-muted-foreground">Welcome to</p>
              <div aria-hidden className="flex flex-col items-center">
                <Letters
                  text="Sahishnus"
                  autoPlay
                  color="url(#nook-grad-md-1)"
                  svgDefs={nookGradient('nook-grad-md-1')}
                  className="h-11 w-auto md:h-14"
                />
                <Letters
                  text="nook"
                  autoPlay
                  color="url(#nook-grad-md-2)"
                  svgDefs={nookGradient('nook-grad-md-2')}
                  className="h-11 w-auto md:h-14"
                />
              </div>
            </div>
          </div>
          <div className="flex h-full min-h-0 min-w-0 flex-col sm:col-span-2 md:col-span-3">
            <StreakCard
              currentStreakDays={s.currentStreakDays}
              longestStreakDays={s.longestStreakDays}
              longestStreakStart={s.longestStreakStart}
              longestStreakEnd={s.longestStreakEnd}
              className="min-h-0 flex-1"
            />
          </div>
        </div>

        <div className="col-span-12 grid gap-2.5 md:grid-cols-12 md:items-stretch md:gap-3">
          <div className="flex min-h-0 min-w-0 flex-col md:col-span-5 md:h-full">
            <CurrentBookCard book={s.currentBook} />
          </div>
          <div className="flex min-h-0 min-w-0 flex-col md:col-span-7 md:h-full">
            <BookshelfRow books={shelfBooks} />
          </div>
        </div>

        <div className="col-span-12 min-w-0">
          <BentoCard title="Activity">
            <ReadingHeatmap calendar={s.calendar} />
          </BentoCard>
        </div>

        <div className="col-span-12 grid grid-cols-1 gap-2.5 md:grid-cols-12 md:gap-3 md:items-stretch">
          <div className="min-h-0 md:col-span-7">
            <HourlyReadingChart
              averageMinutesByHour={s.hourlyReading.averageMinutesByHour}
              personaLabel={s.hourlyReading.personaLabel}
              personaDetail={s.hourlyReading.personaDetail}
            />
          </div>
          <aside className="flex min-h-0 flex-col justify-end md:col-span-5">
            <AppFooterBentoSlot />
          </aside>
        </div>
      </div>
    </div>
  );
}
