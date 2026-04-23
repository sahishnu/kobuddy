import pino from 'pino';

/**
 * A dedicated pino logger used by the ingest route and its middleware so
 * device-sync failures (auth, validation, DB errors) are visible in server
 * logs without relying on request-scoped loggers flowing through sub-routers.
 *
 * In development this uses pino-pretty for readability; in production it
 * emits JSON on stdout so Railway / Fly / Render log collectors can parse it.
 */
const isDev = process.env.NODE_ENV !== 'production';

export const ingestLog = pino({
  name: 'ingest',
  level: isDev ? 'debug' : 'info',
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});
