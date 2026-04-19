import type { MiddlewareHandler } from 'hono';
import type { IronSession } from 'iron-session';
import type { AppConfig } from '../config.js';
import type { SessionData } from './session.js';

export function requirePublicReadOrAdmin(cfg: AppConfig): MiddlewareHandler {
  return async (c, next) => {
    if (cfg.PUBLIC_READ) {
      await next();
      return;
    }
    const session = c.get('session') as IronSession<SessionData> | undefined;
    if (!session?.isAdmin) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  };
}
