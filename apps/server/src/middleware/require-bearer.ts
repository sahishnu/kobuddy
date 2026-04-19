import type { MiddlewareHandler } from 'hono';
import type { AppConfig } from '../config.js';
import { timingSafeStringEqual } from '../lib/token.js';

export function requireIngestToken(cfg: AppConfig): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.req.header('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
    if (!token || !timingSafeStringEqual(token, cfg.INGEST_TOKEN)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  };
}
