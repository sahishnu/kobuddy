import type { MiddlewareHandler } from 'hono';
import type { AppConfig } from '../config.js';
import { clientIp } from '../lib/client-ip.js';
import { ingestLog } from '../lib/logger.js';
import { timingSafeStringEqual } from '../lib/token.js';

export function requireIngestToken(cfg: AppConfig): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.req.header('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (!token || !timingSafeStringEqual(token, cfg.INGEST_TOKEN)) {
      ingestLog.warn(
        {
          path: new URL(c.req.url).pathname,
          method: c.req.method,
          ip: clientIp(c),
          bearerPresent: Boolean(token),
          userAgent: c.req.header('user-agent'),
        },
        'ingest auth failed',
      );
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  };
}
