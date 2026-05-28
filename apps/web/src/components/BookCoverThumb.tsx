import { useState } from 'react';

import { cn } from '@/lib/utils';

type BookCoverThumbProps = {
  coverUrl: string | null;
  displayTitle: string;
  /** `shelf` = larger frame for the home Recent shelf (2:3). */
  variant?: 'list' | 'shelf';
  /** Extra classes on the outer frame (e.g. shadow on shelf). */
  className?: string;
};

const frameList =
  'relative h-[72px] w-12 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-white/10';

const frameShelf =
  'relative aspect-[2/3] w-[7.5rem] shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-white/10';

function CoverTitleFallback({
  title,
  variant,
}: {
  title: string;
  variant: 'list' | 'shelf';
}) {
  return (
    <div className="flex h-full w-full items-center justify-center p-1 text-center">
      <span
        className={cn(
          'font-medium text-muted-foreground',
          variant === 'list'
            ? 'line-clamp-5 text-[9px] leading-tight'
            : 'line-clamp-6 text-[11px] leading-snug',
        )}
      >
        {title}
      </span>
    </div>
  );
}

/**
 * Fixed 2:3 frame so every cover renders the same size; image fills with object-cover.
 */
export function BookCoverThumb({
  coverUrl,
  displayTitle,
  variant = 'list',
  className,
}: BookCoverThumbProps) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const frame = variant === 'shelf' ? frameShelf : frameList;
  const coverSrc = coverUrl?.trim() || null;
  const showImage = coverSrc != null && brokenUrl !== coverSrc;

  return (
    <div
      className={cn(frame, className)}
      {...(showImage
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': displayTitle })}
    >
      {showImage ? (
        <img
          src={coverSrc}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setBrokenUrl(coverSrc)}
        />
      ) : (
        <CoverTitleFallback title={displayTitle} variant={variant} />
      )}
    </div>
  );
}
