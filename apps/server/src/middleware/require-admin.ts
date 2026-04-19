import type { MiddlewareHandler } from 'hono';
import type { IronSession } from 'iron-session';
import type { SessionData } from './session.js';

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const session = c.get('session') as IronSession<SessionData> | undefined;
  if (!session?.isAdmin) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
};
