import type { LoadingQuote } from '@kobuddy/common';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { LoadingQuoteFields } from '@/components/LoadingQuoteFields';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  useCreateLoadingQuote,
  useDeleteLoadingQuote,
  useLoadingQuotes,
  useUpdateLoadingQuote,
} from '@/lib/hooks/loading-quotes';
import {
  emptyLoadingQuoteDraft,
  type LoadingQuoteDraft,
  loadingQuoteDraftFromRow,
  loadingQuoteDraftToInput,
  validateLoadingQuoteDraft,
} from '@/lib/loading-quote-draft';

type Props = {
  /** Fetch the admin list only while the preferences dialog is open. */
  enabled: boolean;
};

export function AdminLoadingQuotesForm({ enabled }: Props) {
  const list = useLoadingQuotes(enabled);
  const create = useCreateLoadingQuote();
  const update = useUpdateLoadingQuote();
  const remove = useDeleteLoadingQuote();
  const addId = useId();

  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState(emptyLoadingQuoteDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<LoadingQuoteDraft>(
    emptyLoadingQuoteDraft,
  );

  const addError = validateLoadingQuoteDraft(addDraft);
  const editError = validateLoadingQuoteDraft(editDraft);

  const startEdit = (q: LoadingQuote) => {
    setAdding(false);
    setEditingId(q.id);
    setEditDraft(loadingQuoteDraftFromRow(q));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(emptyLoadingQuoteDraft());
  };

  const handleCreate = () => {
    if (addError) return;
    create.mutate(loadingQuoteDraftToInput(addDraft), {
      onSuccess: () => {
        setAddDraft(emptyLoadingQuoteDraft());
        setAdding(false);
      },
    });
  };

  const handleUpdate = (id: number) => {
    if (editError) return;
    update.mutate(
      { id, input: loadingQuoteDraftToInput(editDraft) },
      { onSuccess: () => cancelEdit() },
    );
  };

  const handleDelete = (id: number) => {
    if (editingId === id) cancelEdit();
    remove.mutate(id);
  };

  if (list.isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  if (list.isError) {
    return <p className="text-sm text-destructive">{list.error.message}</p>;
  }

  const items = list.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Fiction quotes shown on the app splash when someone opens the site. Only
        enabled quotes are chosen at random.
      </p>

      {items.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">
          No quotes yet. Add one below, or edit{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            default-quotes.ts
          </code>{' '}
          and run{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            pnpm seed:loading-quotes -- --replace
          </code>
          .
        </p>
      ) : null}

      <ul className="space-y-3">
        {items.map((q) =>
          editingId === q.id ? (
            <li
              key={q.id}
              className="rounded-lg border border-border/80 bg-muted/30 p-3"
            >
              <LoadingQuoteFields
                idPrefix={`edit-${q.id}`}
                draft={editDraft}
                onChange={setEditDraft}
                disabled={update.isPending}
              />
              {editError ? (
                <p className="mt-2 text-xs text-destructive">{editError}</p>
              ) : null}
              {update.isError ? (
                <p className="mt-2 text-xs text-destructive">
                  {update.error.message}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleUpdate(q.id)}
                  disabled={Boolean(editError) || update.isPending}
                >
                  {update.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={cancelEdit}
                  disabled={update.isPending}
                >
                  Cancel
                </Button>
              </div>
            </li>
          ) : (
            <li
              key={q.id}
              className="flex gap-3 rounded-lg border border-border/60 px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-serif text-sm leading-snug text-foreground">
                  {q.text}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {q.author} · {q.book}
                  {!q.enabled ? (
                    <span className="ml-2 text-amber-600 dark:text-amber-500">
                      (disabled)
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-start gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Edit quote from ${q.book}`}
                  onClick={() => startEdit(q)}
                  disabled={remove.isPending}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete quote from ${q.book}`}
                  onClick={() => handleDelete(q.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <div className="rounded-lg border border-dashed border-border p-3">
          <LoadingQuoteFields
            idPrefix={addId}
            draft={addDraft}
            onChange={setAddDraft}
            disabled={create.isPending}
          />
          {addError ? (
            <p className="mt-2 text-xs text-destructive">{addError}</p>
          ) : null}
          {create.isError ? (
            <p className="mt-2 text-xs text-destructive">
              {create.error.message}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={Boolean(addError) || create.isPending}
            >
              {create.isPending ? 'Adding…' : 'Add quote'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setAdding(false);
                setAddDraft(emptyLoadingQuoteDraft());
              }}
              disabled={create.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setEditingId(null);
            setAdding(true);
          }}
        >
          <Plus className="size-3.5" />
          Add quote
        </Button>
      )}
    </div>
  );
}
