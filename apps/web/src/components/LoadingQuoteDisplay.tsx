import type { LoadingQuote } from '@kobuddy/common';
import { cn } from '@/lib/utils';

type Props = {
  quote: Pick<LoadingQuote, 'text' | 'author' | 'book'>;
  className?: string;
};

export function LoadingQuoteDisplay({ quote, className }: Props) {
  return (
    <figure
      className={cn(
        'max-w-lg text-center',
        'animate-in fade-in duration-700 fill-mode-both',
        className,
      )}
    >
      <span
        aria-hidden
        className="font-serif text-5xl leading-none text-primary/25 select-none"
      >
        “
      </span>
      <blockquote className="font-serif text-xl leading-relaxed text-balance text-foreground md:text-2xl">
        {quote.text}
      </blockquote>
      <figcaption className="mt-8 text-sm tracking-wide text-muted-foreground">
        <span className="text-foreground/80">{quote.author}</span>
        <span className="mx-1.5 text-muted-foreground/60">·</span>
        <cite className="not-italic">{quote.book}</cite>
      </figcaption>
    </figure>
  );
}
