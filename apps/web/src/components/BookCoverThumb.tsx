import { cn } from '@/lib/utils';

type BookCoverThumbProps = {
  coverUrl: string | null;
  /** `shelf` = larger frame for the home Recent shelf (2:3). */
  variant?: 'list' | 'shelf';
  /** Extra classes on the outer frame (e.g. shadow on shelf). */
  className?: string;
};

const frameList =
  'relative h-[72px] w-12 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-white/10';

const frameShelf =
  'relative aspect-[2/3] w-[7.5rem] shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-white/10';

/**
 * Fixed 2:3 frame so every cover renders the same size; image fills with object-cover.
 */
export function BookCoverThumb({
  coverUrl,
  variant = 'list',
  className,
}: BookCoverThumbProps) {
  const frame = variant === 'shelf' ? frameShelf : frameList;
  return (
    <div className={cn(frame, className)} aria-hidden={!coverUrl}>
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}
