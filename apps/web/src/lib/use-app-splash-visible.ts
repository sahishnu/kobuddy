import { useEffect, useRef, useState } from 'react';

/** Minimum time the splash stays visible (ms). */
export const APP_SPLASH_MIN_MS = 3000;

type Options = {
  /** True while splash content (e.g. quote fetch) is still in flight. */
  pending: boolean;
  /**
   * Minimum time to keep the splash after `pending` becomes false.
   * Pass `0` when there is nothing to show (e.g. no quotes configured).
   */
  minMs?: number;
};

/**
 * One-shot splash visibility for the initial app load.
 *
 * Stays true until `pending` is false and at least `minMs` have passed since mount.
 * The parent (`AppSplashGate`) should not remount on client-side navigation.
 */
export function useAppSplashVisible({
  pending,
  minMs = APP_SPLASH_MIN_MS,
}: Options): boolean {
  const [visible, setVisible] = useState(true);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!visible || pending) return;

    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, minMs - elapsed);
    const id = window.setTimeout(() => setVisible(false), remaining);
    return () => window.clearTimeout(id);
  }, [pending, minMs, visible]);

  return visible;
}
