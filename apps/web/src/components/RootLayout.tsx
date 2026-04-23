import { Outlet, useRouterState } from '@tanstack/react-router';
import { AuthUiProvider } from '@/auth-ui';
import { AppFooterSection } from '@/components/AppFooter';

export function RootLayout() {
  const showFooterOutsideHome = useRouterState({
    select: (s) => s.location.pathname !== '/',
  });

  return (
    <AuthUiProvider>
      <div className="flex min-h-svh flex-col text-foreground antialiased">
        <main className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <Outlet />
          </div>
          {showFooterOutsideHome ? <AppFooterSection /> : null}
        </main>
      </div>
    </AuthUiProvider>
  );
}
