import type { ReactNode } from 'react';
import { AppSplash } from '@/components/AppSplash';
import { useRandomLoadingQuote } from '@/lib/hooks/loading-quotes';
import {
  APP_SPLASH_MIN_MS,
  useAppSplashVisible,
} from '@/lib/use-app-splash-visible';

/**
 * Covers the app with a quote splash once per full page load.
 *
 * Client-side route changes do not remount this component, so navigating
 * between pages does not show the splash again. The app renders underneath
 * so data fetching can start while the splash is visible.
 */
export function AppSplashGate({ children }: { children: ReactNode }) {
  const quoteQuery = useRandomLoadingQuote();
  const showSplash = useAppSplashVisible({
    pending: quoteQuery.isPending,
    minMs: quoteQuery.data ? APP_SPLASH_MIN_MS : 0,
  });

  return (
    <>
      {children}
      {showSplash ? (
        <AppSplash quote={quoteQuery.data} isPending={quoteQuery.isPending} />
      ) : null}
    </>
  );
}
