import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BentoCard } from './BentoCard';

type Props = {
  averageMinutesByHour: number[];
  peakHour: number;
  personaLabel: string;
  personaDetail: string;
};

const TICK_HOUR_SET = new Set([0, 6, 12, 18, 23]);

const HOURS_0_23: number[] = [];
for (let h = 0; h < 24; h++) {
  HOURS_0_23.push(h);
}

export function HourlyReadingChart({
  averageMinutesByHour,
  peakHour: peakHourIndex,
  personaLabel,
  personaDetail,
}: Props) {
  const max = Math.max(1, ...averageMinutesByHour);
  const barH = 120;

  const gridStyle = {
    gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
  } as const;

  return (
    <BentoCard
      title="When you read"
      className="mx-auto h-full w-full max-w-xl md:mx-0 md:max-w-none"
    >
      <div className="space-y-3">
        <div>
          <p className="font-heading text-lg font-semibold tracking-tight">
            {personaLabel}
          </p>
          <p className="text-sm text-muted-foreground">{personaDetail}</p>
        </div>
        <div>
          <div
            className="grid items-end gap-1"
            style={{ ...gridStyle, height: barH }}
          >
            {HOURS_0_23.map((hour) => {
              const mins = averageMinutesByHour[hour] ?? 0;
              const hgt = Math.max(2, (mins / max) * barH);
              const tip = `${hour}:00–${hour + 1}:00 · ~${mins} min / day avg`;
              return (
                <div
                  key={hour}
                  className="flex min-h-0 min-w-0 flex-col justify-end"
                >
                  <Tooltip>
                    <TooltipTrigger
                      delay={200}
                      render={
                        <button
                          type="button"
                          className="w-full min-w-0 rounded-t transition-[height,background-color] duration-150 ease-out"
                          style={{
                            height: hgt,
                            backgroundColor:
                              mins > 0
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
          <div className="border-t border-border/50" />
          <div className="mt-1.5 grid gap-1" style={gridStyle}>
            {HOURS_0_23.map((h) => (
              <div key={h} className="flex min-w-0 justify-center">
                {TICK_HOUR_SET.has(h) ? (
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {h}h
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
