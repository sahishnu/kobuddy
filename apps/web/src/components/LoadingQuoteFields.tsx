import {
  LOADING_QUOTE_AUTHOR_MAX,
  LOADING_QUOTE_BOOK_MAX,
  LOADING_QUOTE_TEXT_MAX,
} from '@kobuddy/common';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LoadingQuoteDraft } from '@/lib/loading-quote-draft';
import { cn } from '@/lib/utils';

type Props = {
  draft: LoadingQuoteDraft;
  onChange: (next: LoadingQuoteDraft) => void;
  disabled: boolean;
  idPrefix: string;
};

export function LoadingQuoteFields({
  draft,
  onChange,
  disabled,
  idPrefix,
}: Props) {
  const textId = `${idPrefix}-text`;
  const authorId = `${idPrefix}-author`;
  const bookId = `${idPrefix}-book`;
  const enabledId = `${idPrefix}-enabled`;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={textId}>Quote</Label>
        <textarea
          id={textId}
          rows={3}
          maxLength={LOADING_QUOTE_TEXT_MAX}
          value={draft.text}
          onChange={(e) => onChange({ ...draft, text: e.target.value })}
          disabled={disabled}
          className={cn(
            'border-input bg-background ring-offset-background placeholder:text-muted-foreground',
            'flex min-h-[4.5rem] w-full rounded-md border px-3 py-2 text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={authorId}>Author</Label>
          <Input
            id={authorId}
            maxLength={LOADING_QUOTE_AUTHOR_MAX}
            value={draft.author}
            onChange={(e) => onChange({ ...draft, author: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={bookId}>Book</Label>
          <Input
            id={bookId}
            maxLength={LOADING_QUOTE_BOOK_MAX}
            value={draft.book}
            onChange={(e) => onChange({ ...draft, book: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>
      <label
        htmlFor={enabledId}
        className="flex cursor-pointer items-center gap-2 text-sm"
      >
        <input
          id={enabledId}
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => onChange({ ...draft, enabled: e.target.checked })}
          disabled={disabled}
          className="size-4 rounded border-input accent-primary"
        />
        Include in splash rotation
      </label>
    </div>
  );
}
