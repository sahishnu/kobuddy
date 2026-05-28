import { Hono } from 'hono';
import type { IronSession } from 'iron-session';
import { describe, expect, it } from 'vitest';
import type { AppEnv, SessionData } from '../middleware/session.js';
import { createInMemoryDb } from '../test-util/in-memory-db.js';
import { testAppConfig } from '../test-util/test-config.js';
import { loadingQuotesRouter } from './loading-quotes.js';

function appWithSession(isAdmin: boolean, publicRead = true) {
  const db = createInMemoryDb();
  const cfg = testAppConfig({ PUBLIC_READ: publicRead });
  const r = loadingQuotesRouter(cfg, db);
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

describe('loadingQuotesRouter', () => {
  it('GET /random returns 404 when empty', async () => {
    const { app } = appWithSession(false);
    const res = await app.request('/random');
    expect(res.status).toBe(404);
  });

  it('GET / requires admin', async () => {
    const { app } = appWithSession(false);
    const res = await app.request('/');
    expect(res.status).toBe(401);
  });

  it('POST creates quote and GET /random returns it', async () => {
    const { app } = appWithSession(true);
    const post = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello world',
        author: 'Author',
        book: 'Book',
      }),
    });
    expect(post.status).toBe(201);

    const random = await app.request('/random');
    expect(random.status).toBe(200);
    const body = (await random.json()) as { text: string };
    expect(body.text).toBe('Hello world');
  });

  it('disabled quotes are excluded from random', async () => {
    const { app } = appWithSession(true);
    const post = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hidden',
        author: 'A',
        book: 'B',
        enabled: false,
      }),
    });
    const created = (await post.json()) as { id: number };
    expect(post.status).toBe(201);

    const random = await app.request('/random');
    expect(random.status).toBe(404);

    await app.request(`/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hidden',
        author: 'A',
        book: 'B',
        enabled: true,
      }),
    });
    const random2 = await app.request('/random');
    expect(random2.status).toBe(200);
  });

  it('DELETE removes quote', async () => {
    const { app } = appWithSession(true);
    const post = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Bye',
        author: 'A',
        book: 'B',
      }),
    });
    const { id } = (await post.json()) as { id: number };

    const del = await app.request(`/${id}`, { method: 'DELETE' });
    expect(del.status).toBe(200);

    const list = await app.request('/');
    const body = (await list.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(0);
  });
});
