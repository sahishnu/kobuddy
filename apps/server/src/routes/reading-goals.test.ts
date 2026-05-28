import { Hono } from 'hono';
import type { IronSession } from 'iron-session';
import { describe, expect, it } from 'vitest';
import type { AppEnv, SessionData } from '../middleware/session.js';
import { createInMemoryDb } from '../test-util/in-memory-db.js';
import { testAppConfig } from '../test-util/test-config.js';
import { readingGoalsRouter } from './reading-goals.js';

function appWithSession(isAdmin: boolean, publicRead = true) {
  const db = createInMemoryDb();
  const cfg = testAppConfig({ PUBLIC_READ: publicRead });
  const r = readingGoalsRouter(cfg, db);
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    const session = {
      isAdmin,
      destroy: () => {},
      save: async () => {},
    } as unknown as IronSession<SessionData>;
    c.set('session', session);
    await next();
  });
  app.route('/', r);
  return { app, db };
}

describe('readingGoalsRouter', () => {
  it('GET returns null books when unset', async () => {
    const { app } = appWithSession(false);
    const res = await app.request('/2026');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { year: number; books: number | null };
    expect(body).toEqual({ year: 2026, books: null });
  });

  it('GET requires auth when PUBLIC_READ is false', async () => {
    const { app } = appWithSession(false, false);
    const res = await app.request('/2026');
    expect(res.status).toBe(401);
  });

  it('PUT requires admin', async () => {
    const { app } = appWithSession(false);
    const res = await app.request('/2026', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ books: 12 }),
    });
    expect(res.status).toBe(401);
  });

  it('PUT sets and GET reads goal', async () => {
    const { app } = appWithSession(true);
    const put = await app.request('/2026', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ books: 12 }),
    });
    expect(put.status).toBe(200);
    const get = await app.request('/2026');
    expect(await get.json()).toEqual({ year: 2026, books: 12 });
  });
});
