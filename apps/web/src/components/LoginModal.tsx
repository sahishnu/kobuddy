import { Dialog } from '@base-ui/react/dialog';
import { useEffect, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { DIALOG_BACKDROP_CLASS, DIALOG_POPUP_CLASS } from '@/lib/dialog-styles';
import { useLogin } from '@/lib/hooks';
import { cn } from '@/lib/utils';

type LoginModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const [password, setPassword] = useState('');
  const login = useLogin();

  useEffect(() => {
    if (!open) setPassword('');
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={cn(DIALOG_BACKDROP_CLASS, 'z-50')} />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Popup className={cn(DIALOG_POPUP_CLASS, 'z-50 max-w-md p-6')}>
            <Dialog.Title className="font-heading text-xl font-semibold tracking-tight">
              Admin login
            </Dialog.Title>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to import KOReader data and manage the server.
            </p>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-modal-password">Password</Label>
                <Input
                  id="login-modal-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !login.isPending) {
                      login.mutate(password, {
                        onSuccess: () => onOpenChange(false),
                      });
                    }
                  }}
                />
              </div>
              {login.isError ? (
                <p className="text-sm text-destructive">
                  {(login.error as Error).message}
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Dialog.Close
                  type="button"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'order-2 w-full sm:order-1 sm:w-auto',
                  )}
                >
                  Cancel
                </Dialog.Close>
                <Button
                  type="button"
                  size="sm"
                  className="order-1 w-full gap-2 sm:order-2 sm:w-auto"
                  disabled={login.isPending}
                  onClick={() =>
                    login.mutate(password, {
                      onSuccess: () => onOpenChange(false),
                    })
                  }
                >
                  {login.isPending ? (
                    <>
                      <Spinner className="size-4 opacity-80" />
                      Signing in…
                    </>
                  ) : (
                    'Sign in'
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
