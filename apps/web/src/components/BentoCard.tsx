import type * as React from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type BentoCardProps = Omit<React.ComponentProps<typeof Card>, 'title'> & {
  title?: React.ReactNode;
  description?: string;
  /** Rendered inline with the title, pushed to the right. */
  action?: React.ReactNode;
  /** Applied to `CardContent` (e.g. `flex flex-1 flex-col` for equal-height layouts). */
  contentClassName?: string;
  children: React.ReactNode;
};

export function BentoCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  ...props
}: BentoCardProps) {
  return (
    <Card
      size="sm"
      className={cn(
        'h-full border-border/70 bg-card/95 shadow-sm ring-1 ring-foreground/[0.06] backdrop-blur-sm transition-shadow duration-200 ease-out hover:ring-foreground/[0.1] dark:bg-card/90 dark:ring-white/[0.04] dark:hover:ring-white/[0.07]',
        className,
      )}
      {...props}
    >
      {title ? (
        <CardHeader className="gap-1 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {title}
            </CardTitle>
            {action}
          </div>
          {description ? (
            <CardDescription className="text-xs">{description}</CardDescription>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(!title && 'pt-6', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
