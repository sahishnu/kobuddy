import type { MiddlewareHandler } from 'hono';
import type { IronSession } from 'iron-session';
import { getIronSession, type SessionOptions } from 'iron-session';

export type SessionData = {
  isAdmin?: boolean;
};

export type AppEnv = {
  Variables: { session: IronSession<SessionData> };
};

export function ironSessionMiddleware(
  options: SessionOptions,
): MiddlewareHandler {
  return async (c, next) => {
    const res = new Response();
    const session = await getIronSession<SessionData>(c.req.raw, res, options);
    c.set('session', session);
    await next();
    await session.save();
    const setCookie = res.headers.get('Set-Cookie');
    if (setCookie) {
      c.header('Set-Cookie', setCookie, { append: true });
    }
  };
}
