import { READING_GOAL_MAX_BOOKS } from '@kobuddy/common';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useReadingGoal, useSetReadingGoal } from '@/lib/hooks';

type Props = {
  year: number;
};

export function AdminReadingGoalForm({ year }: Props) {
  const inputId = useId();
  const goal = useReadingGoal(year, true);
  const save = useSetReadingGoal(year);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (goal.data?.books != null) {
      setDraft(String(goal.data.books));
    } else if (goal.isSuccess) {
      setDraft('');
    }
  }, [goal.data?.books, goal.isSuccess]);

  const parsed = draft.trim() === '' ? null : Number.parseInt(draft, 10);
  const invalid =
    draft.trim() !== '' &&
    (!Number.isFinite(parsed) ||
      parsed == null ||
      parsed < 1 ||
      parsed > READING_GOAL_MAX_BOOKS);

  const handleSave = () => {
    if (invalid) return;
    save.mutate(parsed);
  };

  const handleClear = () => {
    setDraft('');
    save.mutate(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Target number of books to finish in {year}. Shown on the dashboard
        progress ring.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[8rem] flex-1 space-y-1.5">
          <Label htmlFor={inputId}>Books</Label>
          <Input
            id={inputId}
            type="number"
            min={1}
            max={READING_GOAL_MAX_BOOKS}
            inputMode="numeric"
            placeholder="e.g. 12"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={goal.isLoading || save.isPending}
            aria-invalid={invalid}
          />
          {invalid ? (
            <p className="text-xs text-destructive">
              Enter a number from 1 to {READING_GOAL_MAX_BOOKS.toLocaleString()}
              .
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={goal.isLoading || save.isPending || invalid}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleClear}
            disabled={
              goal.isLoading ||
              save.isPending ||
              (goal.data?.books == null && draft.trim() === '')
            }
          >
            Clear
          </Button>
        </div>
      </div>
      {save.isError ? (
        <p className="text-xs text-destructive">{save.error.message}</p>
      ) : null}
    </div>
  );
}
