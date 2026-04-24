import type { WeekDayReading } from '@kobuddy/common';
import { BookOpen, Clock } from 'lucide-react';
import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BentoCard } from './BentoCard';

type Props = {
  weekDailyReading: WeekDayReading[];
  className?: string;
};

const barH = 100;

function formatTotal(minutes: number): string {
  if (minutes < 60) return `${minutes}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}`;
}

export function WeekPagesCard({ weekDailyReading, className }: Props) {
  const [mode, setMode] = useState<'pages' | 'minutes'>('pages');
  const todayDow = new Date().getDay() || 7;

  const totalPages = weekDailyReading.reduce((s, d) => s + d.pages, 0);
  const totalMinutes = weekDailyReading.reduce((s, d) => s + d.minutes, 0);

  const values = weekDailyReading.map((d) =>
    mode === 'pages' ? d.pages : d.minutes,
  );
  const max = Math.max(1, ...values);

  const gridStyle = {
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  } as const;

  const nextMode = mode === 'pages' ? 'minutes' : 'pages';
  const Icon = mode === 'pages' ? BookOpen : Clock;

  const toggleButton = (
    <Tooltip>
      <TooltipTrigger
        delay={200}
        render={
          <button
            type="button"
            onClick={() => setMode(nextMode)}
            className="cursor-pointer rounded-md border border-border/70 bg-muted/50 p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Switch to ${nextMode}`}
          >
            <Icon className="size-3.5" />
          </button>
        }
      />
      <TooltipContent side="bottom">Switch to {nextMode}</TooltipContent>
    </Tooltip>
  );

  return (
    <BentoCard
      title="This week"
      action={toggleButton}
      className={cn('h-full', className)}
    >
      <div className="space-y-4">
        <p className="font-heading text-2xl tracking-tight md:text-3xl">
          {mode === 'pages'
            ? totalPages.toLocaleString()
            : formatTotal(totalMinutes)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {mode === 'pages' ? 'pages read' : 'minutes read'}
          </span>
        </p>

        <div>
          <div className="flex gap-1.5">
            <div
              className="flex shrink-0 flex-col justify-between text-right"
              style={{ height: barH }}
            >
              <span className="text-[10px] leading-none tabular-nums text-muted-foreground">
                {max}
              </span>
              <span className="text-[10px] leading-none tabular-nums text-muted-foreground">
                {Math.round(max / 2)}
              </span>
              <span className="text-[10px] leading-none tabular-nums text-muted-foreground">
                0
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="grid items-end gap-1"
                style={{ ...gridStyle, height: barH }}
              >
                {weekDailyReading.map((day) => {
                  const val = mode === 'pages' ? day.pages : day.minutes;
                  const hgt = Math.max(2, (val / max) * barH);
                  const isToday = day.dow === todayDow;
                  const tip = `${day.label} · ${val} ${mode === 'pages' ? 'pages' : 'min'}`;
                  return (
                    <div
                      key={day.dow}
                      className="flex min-h-0 min-w-0 flex-col justify-end"
                    >
                      <Tooltip>
                        <TooltipTrigger
                          delay={200}
                          render={
                            <button
                              type="button"
                              className="w-full min-w-0 rounded transition-[height,background-color] duration-150 ease-out"
                              style={{
                                height: hgt,
                                backgroundColor: isToday
                                  ? 'var(--color-reading)'
                                  : 'color-mix(in oklab, var(--muted-foreground) 35%, var(--card))',
                              }}
                              aria-label={tip}
                            />
                          }
                        />
                        <TooltipContent side="top">{tip}</TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 grid gap-1" style={gridStyle}>
                {weekDailyReading.map((day) => (
                  <div key={day.dow} className="flex min-w-0 justify-center">
                    <span className="text-[10px] text-muted-foreground">
                      {day.label.charAt(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
