import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { Hono } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import type { IronSession } from 'iron-session';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import type { SessionData } from '../middleware/session.js';

const loginSchema = z.object({
  password: z.string().min(1),
});

export function authRouter(cfg: AppConfig) {
  const adminHash = bcrypt.hashSync(cfg.ADMIN_PASSWORD, 12);

  const r = new Hono<{ Variables: { session: IronSession<SessionData> } }>();

  const loginLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: (c) =>
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-real-ip') ??
      'local',
  });

  r.post('/login', loginLimiter, zValidator('json', loginSchema), async (c) => {
    const { password } = c.req.valid('json');
    const ok = bcrypt.compareSync(password, adminHash);
    if (!ok) {
      return c.json({ error: 'Invalid password' }, 401);
    }
    const session = c.get('session');
    session.isAdmin = true;
    return c.json({ ok: true });
  });

  r.post('/logout', async (c) => {
    const session = c.get('session');
    session.destroy();
    return c.json({ ok: true });
  });

  r.get('/me', async (c) => {
    const session = c.get('session');
    return c.json({ isAdmin: Boolean(session.isAdmin) });
  });

  return r;
}
