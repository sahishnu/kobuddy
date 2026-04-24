import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BentoCard } from './BentoCard';

type Props = {
  currentStreakDays: number;
  longestStreakDays: number;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
  className?: string;
};

function formatStreakRange(
  start: string | null,
  end: string | null,
): string | null {
  if (!start || !end) return null;
  const s = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`;
}

export function StreakCard({
  currentStreakDays,
  longestStreakDays,
  longestStreakStart,
  longestStreakEnd,
  className,
}: Props) {
  const rangeLabel = formatStreakRange(longestStreakStart, longestStreakEnd);
  const isActive = currentStreakDays > 0;

  return (
    <BentoCard
      title={
        <span className="inline-flex items-center gap-1.5">
          <Flame
            className={cn(
              'size-3.5',
              isActive && 'fill-current text-orange-500',
            )}
          />
          Streak
        </span>
      }
      className={cn('h-full', className)}
    >
      <div className="flex flex-col gap-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Current</p>
          <p className="font-heading text-2xl tracking-tight">
            {currentStreakDays} days
          </p>
          {isActive && (
            <p className="text-xs text-muted-foreground">Keep it going!</p>
          )}
        </div>
        <div className="h-px w-full bg-border" />
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Longest Streak</p>
          <p className="font-heading text-2xl tracking-tight">
            {longestStreakDays} days
          </p>
          {rangeLabel && (
            <p className="text-xs text-muted-foreground">{rangeLabel}</p>
          )}
        </div>
      </div>
    </BentoCard>
  );
}
