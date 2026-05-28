import { coversLog } from '../../lib/logger.js';

export type FetchJsonOptions = {
  /** Log label when the HTTP response is not OK (e.g. provider name). */
  provider?: string;
};

export async function fetchJson<T>(
  url: string,
  opts?: FetchJsonOptions,
): Promise<T | null> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    if (opts?.provider) {
      coversLog.warn(
        { provider: opts.provider, status: res.status, url },
        'provider JSON request failed',
      );
    }
    return null;
  }
  return (await res.json()) as T;
}
