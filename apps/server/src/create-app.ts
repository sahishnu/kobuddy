import fs from 'node:fs';
import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Scalar } from '@scalar/hono-api-reference';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { pinoLogger } from 'hono-pino';
import type { IronSession } from 'iron-session';
import pino from 'pino';
import type { AppConfig } from './config.js';
import type { DbClient } from './lib/db.js';
import {
  ironSessionMiddleware,
  type SessionData,
} from './middleware/session.js';
import { openApiDocument } from './openapi-spec.js';
import { authRouter } from './routes/auth.js';
import { booksRouter } from './routes/books.js';
import { ingestRouter } from './routes/ingest.js';
import { pluginZipRouter } from './routes/plugin-zip.js';
import { statsRouter } from './routes/stats.js';
import { sessionOptions } from './session-options.js';

type AppEnv = {
  Variables: { session: IronSession<SessionData> };
};

export function createApp(cfg: AppConfig, db: DbClient, webDistAbs: string) {
  const app = new Hono<AppEnv>();

  // Browsers reject `Access-Control-Allow-Origin: *` combined with
  // `Access-Control-Allow-Credentials: true`. In production the UI and API
  // are served from the same origin so CORS is only exercised in dev or when
  // an admin UI is hosted separately. Echo the caller's Origin so credentialed
  // requests work, and fall back to `*` for anonymous cross-origin probes.
  app.use(
    '*',
    cors({
      origin: (origin) => origin ?? '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      credentials: true,
    }),
  );

  app.use(
    pinoLogger({
      pino: pino({
        level: cfg.NODE_ENV === 'development' ? 'debug' : 'info',
        transport:
          cfg.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      }),
    }),
  );

  const sessionMw = ironSessionMiddleware(sessionOptions(cfg));

  app.use('*', async (c, next) => {
    const p = new URL(c.req.url).pathname;
    if (p.startsWith('/api/ingest')) return next();
    if (p === '/api/openapi.json' || p.startsWith('/api/docs')) return next();
    if (p.startsWith('/api/')) return sessionMw(c, next);
    return next();
  });

  const api = new Hono<AppEnv>();

  api.route('/auth', authRouter(cfg));
  api.route('/ingest', ingestRouter(cfg, db));
  api.route('/books', booksRouter(cfg, db));
  api.route('/stats', statsRouter(cfg, db));

  api.get('/openapi.json', (c) => c.json(openApiDocument));

  api.get(
    '/docs',
    Scalar({
      url: '/api/openapi.json',
      pageTitle: 'kobuddy API',
    }),
  );

  app.route('/api', api);
  app.route('/', pluginZipRouter());

  const spaEnabled = fs.existsSync(path.join(webDistAbs, 'index.html'));
  const staticRoot = path.relative(process.cwd(), webDistAbs) || '.';
  if (spaEnabled) {
    app.use('/*', serveStatic({ root: staticRoot }));
  }

  app.notFound(async (c) => {
    const p = new URL(c.req.url).pathname;
    if (
      spaEnabled &&
      !p.startsWith('/api') &&
      p !== '/plugin.zip' &&
      c.req.header('accept')?.includes('text/html')
    ) {
      const html = await fs.promises.readFile(
        path.join(webDistAbs, 'index.html'),
        'utf8',
      );
      return c.html(html);
    }
    return c.json({ error: 'Not found' }, 404);
  });

  return app;
}
