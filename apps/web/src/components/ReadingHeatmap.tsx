import type { CalendarDay } from '@kobuddy/common';
import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const DAYS_WINDOW = 365;

const ROW_DOW_LABEL: { key: string; label: string | null }[] = [
  { key: 'sun', label: null },
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: null },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: null },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: null },
];

const LABEL_COL_WIDTH = 32;
/** Default before client matchMedia runs (SSR / first paint). */
const CELL_PX_DEFAULT = 13;

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addLocalDays(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}

type Cell = { date: string; minutes: number };

function buildHeatmapCells(calendar: CalendarDay[]): Cell[] {
  const byDate = new Map(calendar.map((c) => [c.date, c.minutes] as const));
  const end = startOfLocalDay(new Date());
  const start = addLocalDays(end, -(DAYS_WINDOW - 1));
  const days: Cell[] = [];
  for (let i = 0; i < DAYS_WINDOW; i++) {
    const d = addLocalDays(start, i);
    const key = localYmd(d);
    days.push({ date: key, minutes: byDate.get(key) ?? 0 });
  }
  return days;
}

function padToWeekGrid(days: Cell[]): { key: string; cell: Cell | null }[] {
  const firstDay = days[0];
  if (!firstDay) return [];
  const first = new Date(`${firstDay.date}T12:00:00`);
  const leading = first.getDay();
  const out: { key: string; cell: Cell | null }[] = [];
  for (let i = 0; i < leading; i++) {
    out.push({ key: `lead-${i}`, cell: null });
  }
  for (const d of days) {
    out.push({ key: d.date, cell: d });
  }
  let t = 0;
  while (out.length % 7 !== 0) {
    out.push({ key: `trail-${t}`, cell: null });
    t++;
  }
  return out;
}

function buildMonthLabels(
  items: { key: string; cell: Cell | null }[],
): string[] {
  const numWeeks = items.length / 7;
  const labels: string[] = [];
  let lastMonthKey = '';

  for (let c = 0; c < numWeeks; c++) {
    const datesInCol: Date[] = [];
    for (let r = 0; r < 7; r++) {
      const cell = items[c * 7 + r]?.cell;
      if (cell) datesInCol.push(new Date(`${cell.date}T12:00:00`));
    }
    if (datesInCol.length === 0) {
      labels.push('');
      continue;
    }
    const minD = datesInCol.reduce((a, b) => (a < b ? a : b));
    const monthKey = `${minD.getFullYear()}-${minD.getMonth()}`;
    if (monthKey !== lastMonthKey) {
      labels.push(
        minD.toLocaleString(undefined, { month: 'short' }).replace('.', ''),
      );
      lastMonthKey = monthKey;
    } else {
      labels.push('');
    }
  }
  return labels;
}

function formatDayLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type ReadingHeatmapProps = {
  calendar: CalendarDay[];
};

function useHeatmapCellPx(): number {
  const [cellPx, setCellPx] = useState(CELL_PX_DEFAULT);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setCellPx(mq.matches ? 15 : 13);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return cellPx;
}

/** When the heatmap is wider than the viewport, scroll so the latest weeks are visible. */
function useScrollHeatmapToEnd(scrollRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const snap = () => {
      if (el.scrollWidth > el.clientWidth) {
        el.scrollLeft = el.scrollWidth - el.clientWidth;
      }
    };

    snap();
    const ro = new ResizeObserver(snap);
    ro.observe(el);
    return () => ro.disconnect();
  });
}

export function ReadingHeatmap({ calendar }: ReadingHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cellPx = useHeatmapCellPx();

  const days = buildHeatmapCells(calendar);
  const items = padToWeekGrid(days);
  const maxMinutes = Math.max(1, ...days.map((d) => d.minutes));
  const numWeeks = items.length / 7;
  const monthLabels = buildMonthLabels(items);

  useScrollHeatmapToEnd(scrollRef);

  return (
    <div className="-mx-1 min-w-0 px-1 md:mx-0 md:px-0">
      <div className="flex min-w-0 items-start gap-[3px]">
        {/* Fixed column: weekdays never scroll horizontally */}
        <div className="shrink-0 bg-card" style={{ width: LABEL_COL_WIDTH }}>
          <div className="h-5 shrink-0" aria-hidden />
          <div
            className="grid shrink-0 gap-[3px] text-right"
            style={{
              gridTemplateRows: `repeat(7, ${cellPx}px)`,
            }}
          >
            {ROW_DOW_LABEL.map(({ key, label: lab }) => (
              <span
                key={key}
                className="pr-1 text-[10px] text-muted-foreground"
                style={{ lineHeight: `${cellPx}px` }}
              >
                {lab ?? ''}
              </span>
            ))}
          </div>
        </div>

        {/* Month strip + grid scroll together */}
        <div
          ref={scrollRef}
          className="min-w-0 flex-1 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]"
        >
          <div className="inline-flex min-w-min flex-col gap-1.5">
            <div
              className="grid shrink-0 gap-[3px]"
              style={{
                gridTemplateColumns: `repeat(${numWeeks}, ${cellPx}px)`,
              }}
            >
              {monthLabels.map((label, weekIndex) => (
                <div
                  key={`month-${items[weekIndex * 7]?.key ?? 'col'}`}
                  className="relative h-5 shrink-0"
                  style={{ width: cellPx }}
                >
                  {label ? (
                    <span className="absolute bottom-0 left-0 text-[10px] leading-none whitespace-nowrap text-muted-foreground">
                      {label}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <div
              className="grid shrink-0 gap-[3px]"
              style={{
                gridTemplateRows: `repeat(7, ${cellPx}px)`,
                gridAutoFlow: 'column',
                gridAutoColumns: `${cellPx}px`,
              }}
            >
              {items.map(({ key, cell }) => {
                if (!cell) {
                  return (
                    <div
                      key={key}
                      style={{ width: cellPx, height: cellPx }}
                      className="rounded-[2px]"
                    />
                  );
                }
                const t = cell.minutes / maxMinutes;
                const bg =
                  cell.minutes === 0
                    ? undefined
                    : `color-mix(in oklab, var(--color-reading) ${Math.round(18 + t * 82)}%, var(--card))`;

                const label =
                  cell.minutes === 0
                    ? `${formatDayLabel(cell.date)} · No reading logged`
                    : `${formatDayLabel(cell.date)} · ${cell.minutes} min`;

                return (
                  <Tooltip key={key}>
                    <TooltipTrigger
                      delay={250}
                      render={
                        <div
                          role="img"
                          aria-label={label}
                          className="rounded-[2px] bg-muted"
                          style={{
                            width: cellPx,
                            height: cellPx,
                            backgroundColor: bg ?? undefined,
                            cursor: 'default',
                          }}
                        />
                      }
                    />
                    <TooltipContent side="top" className="max-w-xs">
                      {label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
