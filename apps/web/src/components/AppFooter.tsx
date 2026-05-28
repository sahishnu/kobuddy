import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Link } from '@tanstack/react-router';
import { Globe, LibraryBig, LogOut, Moon, Sun, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthUi } from '@/auth-ui';
import { BentoCard } from '@/components/BentoCard';
import { ImportKoreaderModal } from '@/components/ImportKoreaderModal';
import { Button, buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { DIALOG_BACKDROP_CLASS, DIALOG_POPUP_CLASS } from '@/lib/dialog-styles';
import { useLogout, useMe } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/theme-provider';

const AUTHOR_SITE = 'https://www.sahi.sh/';

type AppFooterContentProps = {
  className?: string;
};

export function AppFooterContent({ className }: AppFooterContentProps) {
  const { theme, toggleTheme } = useTheme();
  const { openLoginModal } = useAuthUi();
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [importKoreaderOpen, setImportKoreaderOpen] = useState(false);

  const me = useMe();

  const logout = useLogout();

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    if (!me.data?.isAdmin) setImportKoreaderOpen(false);
  }, [me.data?.isAdmin]);

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-5 text-sm',
        'dark:[&_button]:text-zinc-400 dark:[&_a]:text-zinc-400',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 text-foreground/80 dark:text-inherit">
        <div className="flex items-start gap-2.5" title="Browser time zone">
          <Globe
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="min-w-0 break-all font-mono text-xs leading-snug text-foreground/90 dark:text-inherit">
            {timeZone ?? '…'}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Made by{' '}
          <a
            href={AUTHOR_SITE}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-foreground underline-offset-4 transition-colors hover:text-reading hover:underline"
          >
            Sahishnu
          </a>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
        {me.data?.isAdmin ? (
          <>
            <Link
              to="/admin/books"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'inline-flex gap-2 no-underline',
              )}
            >
              <LibraryBig className="size-4 shrink-0 opacity-80" aria-hidden />
              Library admin
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setImportKoreaderOpen(true)}
            >
              <Upload className="size-4 shrink-0 opacity-80" aria-hidden />
              Import
            </Button>
            <ImportKoreaderModal
              open={importKoreaderOpen}
              onOpenChange={setImportKoreaderOpen}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={logout.isPending}
              onClick={() => setLogoutDialogOpen(true)}
              aria-label="Log out"
            >
              <LogOut className="size-4 shrink-0 opacity-80" aria-hidden />
              Log out
            </Button>
            <AlertDialog.Root
              open={logoutDialogOpen}
              onOpenChange={setLogoutDialogOpen}
            >
              <AlertDialog.Portal>
                <AlertDialog.Backdrop
                  className={cn(DIALOG_BACKDROP_CLASS, 'z-[60]')}
                />
                <AlertDialog.Viewport className="fixed inset-0 z-[60] grid place-items-center p-4">
                  <AlertDialog.Popup
                    className={cn(DIALOG_POPUP_CLASS, 'z-[60] max-w-sm p-6')}
                  >
                    <AlertDialog.Title className="font-heading text-lg font-semibold tracking-tight">
                      Log out?
                    </AlertDialog.Title>
                    <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
                      You will need to sign in again to use admin features such
                      as importing your KOReader database and editing books.
                    </AlertDialog.Description>
                    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <AlertDialog.Close
                        type="button"
                        className={cn(
                          buttonVariants({ variant: 'outline', size: 'sm' }),
                          'w-full sm:w-auto',
                        )}
                      >
                        Cancel
                      </AlertDialog.Close>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="w-full gap-2 sm:w-auto"
                        disabled={logout.isPending}
                        onClick={() =>
                          logout.mutate(undefined, {
                            onSuccess: () => setLogoutDialogOpen(false),
                          })
                        }
                      >
                        {logout.isPending ? (
                          <Spinner className="size-4 opacity-80" aria-hidden />
                        ) : null}
                        Log out
                      </Button>
                    </div>
                  </AlertDialog.Popup>
                </AlertDialog.Viewport>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openLoginModal()}
          >
            Login
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={toggleTheme}
          aria-label={
            theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
          }
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="size-4" aria-hidden />
          ) : (
            <Moon className="size-4" aria-hidden />
          )}
        </Button>

        <a
          href="/plugin.zip"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'no-underline',
          )}
        >
          Plugin
        </a>
      </div>
    </div>
  );
}

type AppFooterBentoSlotProps = {
  className?: string;
};

export function AppFooterBentoSlot({ className }: AppFooterBentoSlotProps) {
  return (
    <BentoCard title="App" className={cn('h-full', className)}>
      <AppFooterContent />
    </BentoCard>
  );
}

export function AppFooterSection() {
  return (
    <footer className="mt-auto w-full shrink-0">
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-8 pt-2 md:px-5">
        <AppFooterBentoSlot />
      </div>
    </footer>
  );
}
