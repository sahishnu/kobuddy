import { cn } from '@/lib/utils';
import { BentoCard } from './BentoCard';

type Props = {
  currentStreakDays: number;
  longestStreakDays: number;
  className?: string;
};

export function StreakCard({
  currentStreakDays,
  longestStreakDays,
  className,
}: Props) {
  return (
    <BentoCard title="Streaks" className={cn('h-full', className)}>
      <div className="flex flex-wrap gap-x-10 gap-y-6">
        <div className="min-w-[10rem] flex-1 space-y-1">
          <p className="text-sm text-muted-foreground">Current</p>
          <p className="font-heading text-2xl tracking-tight">
            {currentStreakDays} days
          </p>
          <p className="text-xs text-muted-foreground">
            Days in a row with reading (through yesterday if today is empty).
          </p>
        </div>
        <div className="min-w-[8rem] flex-1 space-y-1">
          <p className="text-sm text-muted-foreground">Best</p>
          <p className="font-heading text-2xl tracking-tight">
            {longestStreakDays} days
          </p>
        </div>
      </div>
    </BentoCard>
  );
}
