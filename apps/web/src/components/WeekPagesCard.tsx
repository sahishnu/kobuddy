import { cn } from '@/lib/utils';
import { BentoCard } from './BentoCard';

type Props = {
  pagesReadThisIsoWeek: number;
  className?: string;
};

export function WeekPagesCard({ pagesReadThisIsoWeek, className }: Props) {
  return (
    <BentoCard title="This week" className={cn('h-full', className)}>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Pages read (ISO week)</p>
        <p className="font-heading text-3xl tracking-tight md:text-4xl">
          {pagesReadThisIsoWeek.toLocaleString()}
        </p>
      </div>
    </BentoCard>
  );
}
