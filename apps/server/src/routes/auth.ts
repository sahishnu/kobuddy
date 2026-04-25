import { zValidator } from '@hono/zod-validator';
import bcrypt from 'bcryptjs';
import { Hono } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { clientIp } from '../lib/client-ip.js';
import type { AppEnv } from '../middleware/session.js';

const loginSchema = z.object({
  password: z.string().min(1),
});

export function authRouter(cfg: AppConfig) {
  const adminHash = bcrypt.hashSync(cfg.ADMIN_PASSWORD, 12);

  const r = new Hono<AppEnv>();

  const loginLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: (c) => clientIp(c),
  });

  r.post('/login', loginLimiter, zValidator('json', loginSchema), async (c) => {
    const { password } = c.req.valid('json');
    const ok = await bcrypt.compare(password, adminHash);
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
