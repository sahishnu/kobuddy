import { Dialog } from '@base-ui/react/dialog';
import { localCalendarYear } from '@kobuddy/common';
import { useMemo } from 'react';
import { AdminLoadingQuotesForm } from '@/components/AdminLoadingQuotesForm';
import { AdminReadingGoalForm } from '@/components/AdminReadingGoalForm';
import { buttonVariants } from '@/components/ui/button';
import { DIALOG_BACKDROP_CLASS, DIALOG_POPUP_CLASS } from '@/lib/dialog-styles';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdminPreferencesDialog({ open, onOpenChange }: Props) {
  const statsTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    [],
  );
  const goalYear = useMemo(
    () => localCalendarYear(statsTimeZone),
    [statsTimeZone],
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={cn(DIALOG_BACKDROP_CLASS, 'z-[60]')} />
        <Dialog.Viewport className="fixed inset-0 z-[60] grid place-items-center p-4">
          <Dialog.Popup
            className={cn(
              DIALOG_POPUP_CLASS,
              'z-[60] flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden',
            )}
          >
            <div className="shrink-0 border-b border-border/60 px-5 py-4">
              <Dialog.Title className="font-heading text-lg font-semibold tracking-tight">
                Preferences
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Site-wide settings for your nook. More options may appear here
                over time.
              </Dialog.Description>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <section className="space-y-3">
                <h2 className="font-heading text-sm font-semibold tracking-tight">
                  {goalYear} reading goal
                </h2>
                <AdminReadingGoalForm year={goalYear} />
              </section>
              <section className="space-y-3 border-t border-border/60 pt-6">
                <h2 className="font-heading text-sm font-semibold tracking-tight">
                  Splash quotes
                </h2>
                <AdminLoadingQuotesForm enabled={open} />
              </section>
            </div>
            <div className="shrink-0 border-t border-border/60 px-5 py-3">
              <Dialog.Close
                type="button"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'w-full sm:ml-auto sm:w-auto',
                )}
              >
                Done
              </Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
