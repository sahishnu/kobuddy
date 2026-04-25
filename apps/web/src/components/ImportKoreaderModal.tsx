import { Dialog } from '@base-ui/react/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiJson } from '@/api';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { DIALOG_BACKDROP_CLASS, DIALOG_POPUP_CLASS } from '@/lib/dialog-styles';
import { cn } from '@/lib/utils';

type ImportKoreaderModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportKoreaderModal({
  open,
  onOpenChange,
}: ImportKoreaderModalProps) {
  const queryClient = useQueryClient();
  const [sqliteFile, setSqliteFile] = useState<File | null>(null);
  const [deviceId, setDeviceId] = useState('');

  const importSqlite = useMutation({
    mutationFn: async () => {
      if (!sqliteFile)
        throw new Error('Choose statistics.sqlite or statistics.sqlite3');
      const fd = new FormData();
      fd.append('file', sqliteFile);
      if (deviceId.trim()) fd.append('device_id', deviceId.trim());
      return apiJson<{
        ok: boolean;
        booksImported: number;
        pageStatsImported: number;
      }>('/api/books/import-sqlite', { method: 'POST', body: fd });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
      void queryClient.invalidateQueries({ queryKey: ['books'] });
      setSqliteFile(null);
    },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: only reset form state when the modal opens/closes
  useEffect(() => {
    if (!open) {
      setSqliteFile(null);
      setDeviceId('');
      importSqlite.reset();
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={cn(DIALOG_BACKDROP_CLASS, 'z-50')} />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Popup
            className={cn(
              DIALOG_POPUP_CLASS,
              'z-50 max-h-[min(90dvh,720px)] max-w-lg overflow-y-auto p-6',
            )}
          >
            <Dialog.Title className="font-heading text-xl font-semibold tracking-tight">
              Import KOReader database
            </Dialog.Title>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload your device&apos;s{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                koreader/settings/statistics.sqlite3
              </code>{' '}
              (copied via USB or cloud). Same data shape the plugin syncs over
              the network.
            </p>
            <div className="mt-5 flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="import-sqlite-file">
                  statistics.sqlite / statistics.sqlite3
                </Label>
                <input
                  id="import-sqlite-file"
                  type="file"
                  accept=".sqlite,.sqlite3,application/x-sqlite3"
                  className={cn(
                    'block w-full cursor-pointer text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-foreground',
                  )}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setSqliteFile(f);
                    importSqlite.reset();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-device-id">Device id (optional)</Label>
                <Input
                  id="import-device-id"
                  placeholder="e-reader name"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Stored on page-level stats; leave blank for unknown-device.
                </p>
              </div>
              {importSqlite.isError ? (
                <p className="text-sm text-destructive">
                  {(importSqlite.error as Error).message}
                </p>
              ) : null}
              {importSqlite.isSuccess ? (
                <p className="text-sm text-reading">
                  Imported {importSqlite.data.booksImported} books,{' '}
                  {importSqlite.data.pageStatsImported} page stat rows.
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Dialog.Close
                  type="button"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'w-full sm:w-auto',
                  )}
                >
                  Close
                </Dialog.Close>
                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-2 sm:w-auto"
                  disabled={!sqliteFile || importSqlite.isPending}
                  onClick={() => importSqlite.mutate()}
                >
                  {importSqlite.isPending ? (
                    <>
                      <Spinner className="size-4 opacity-80" />
                      Importing…
                    </>
                  ) : (
                    'Import into kobuddy'
                  )}
                </Button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
