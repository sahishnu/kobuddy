import type { LoadingQuote } from '@kobuddy/common';
import { LoadingQuoteDisplay } from '@/components/LoadingQuoteDisplay';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type Props = {
  quote: LoadingQuote | undefined;
  /** Quote request still in flight. */
  isPending: boolean;
  className?: string;
};

/**
 * Full-screen overlay for the one-time app splash (see `AppSplashGate`).
 */
export function AppSplash({ quote, isPending, className }: Props) {
  const showQuote = Boolean(quote) && !isPending;

  return (
    <output
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center border-0 bg-background px-6 py-16',
        className,
      )}
      aria-live="polite"
      aria-busy={!showQuote}
      aria-label="Loading application"
    >
      {showQuote && quote ? (
        <LoadingQuoteDisplay quote={quote} />
      ) : (
        <Spinner className="size-6 text-muted-foreground" />
      )}
    </output>
  );
}
