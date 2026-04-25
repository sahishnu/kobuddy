import { zValidator } from '@hono/zod-validator';
import { devicePayloadSchema, ingestPayloadSchema } from '@kobuddy/common';
import { type Context, Hono } from 'hono';
import type { z } from 'zod';
import type { AppConfig } from '../config.js';
import { clientIp } from '../lib/client-ip.js';
import type { DbClient } from '../lib/db.js';
import { ingestLog } from '../lib/logger.js';
import { requireIngestToken } from '../middleware/require-bearer.js';
import {
  ingestReadingData,
  registerDevice,
} from '../services/ingest-service.js';
import {
  deviceIdFromMultipartField,
  importStatisticsSqliteFromUpload,
} from '../services/sqlite-statistics-import.js';

function withPluginVersion<T extends z.ZodType>(cfg: AppConfig, schema: T) {
  return schema.superRefine((val, ctx) => {
    const v = (val as { version?: string }).version;
    if (v !== cfg.REQUIRED_PLUGIN_VERSION) {
      ctx.addIssue({
        code: 'custom',
        message: `Unsupported plugin version. Expected ${cfg.REQUIRED_PLUGIN_VERSION}.`,
        path: ['version'],
      });
    }
  });
}

type ValidatorIssue = {
  path: ReadonlyArray<PropertyKey>;
  code: string;
  message: string;
};

/**
 * zValidator hook that logs schema failures before returning the standard 400.
 * Without this, validation errors (e.g. plugin version mismatch, missing
 * fields) are invisible in server logs and hard to diagnose remotely.
 *
 * The parameter type is intentionally loose because zValidator's Hook type is
 * generic over the parsed schema and hard to satisfy with a shared helper.
 */
function logValidationIssues(route: string) {
  // biome-ignore lint/suspicious/noExplicitAny: hook type is generic over the parsed schema
  return (result: any, c: Context): Response | void => {
    if (result?.success) return;
    const issues: ValidatorIssue[] = result?.error?.issues ?? [];
    ingestLog.warn(
      {
        route,
        ip: clientIp(c),
        userAgent: c.req.header('user-agent'),
        issues: issues.map((i) => ({
          path: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      },
      'ingest validation failed',
    );
    // Surface the first human-readable issue in the response so the plugin
    // can display something useful to the user.
    const first = issues[0];
    const message = first
      ? `${first.path.join('.') || 'body'}: ${first.message}`
      : 'Invalid request';
    return c.json({ error: message, issues }, 400);
  };
}

export function ingestRouter(cfg: AppConfig, db: DbClient) {
  const r = new Hono();

  const deviceBody = withPluginVersion(cfg, devicePayloadSchema);
  const importBody = withPluginVersion(cfg, ingestPayloadSchema);

  r.post(
    '/device',
    requireIngestToken(cfg),
    zValidator('json', deviceBody, logValidationIssues('/device')),
    async (c) => {
      const body = c.req.valid('json');
      try {
        await registerDevice(db, body.id, body.model);
      } catch (e) {
        ingestLog.error(
          {
            route: '/device',
            ip: clientIp(c),
            deviceId: body.id,
            err:
              e instanceof Error ? { message: e.message, stack: e.stack } : e,
          },
          'device registration failed',
        );
        return c.json(
          { error: 'Failed to register device. See server logs.' },
          500,
        );
      }
      ingestLog.info(
        {
          route: '/device',
          ip: clientIp(c),
          deviceId: body.id,
          deviceModel: body.model,
          pluginVersion: body.version,
        },
        'device registered',
      );
      return c.json({ message: 'Device registered successfully' });
    },
  );

  r.post(
    '/import',
    requireIngestToken(cfg),
    zValidator('json', importBody, logValidationIssues('/import')),
    async (c) => {
      const body = c.req.valid('json');
      try {
        ingestReadingData(db, body.books, body.stats);
      } catch (e) {
        ingestLog.error(
          {
            route: '/import',
            ip: clientIp(c),
            bookCount: body.books.length,
            statCount: body.stats.length,
            err:
              e instanceof Error ? { message: e.message, stack: e.stack } : e,
          },
          'reading data ingest failed',
        );
        return c.json(
          { error: 'Failed to ingest reading data. See server logs.' },
          500,
        );
      }
      ingestLog.info(
        {
          route: '/import',
          ip: clientIp(c),
          bookCount: body.books.length,
          statCount: body.stats.length,
          pluginVersion: body.version,
        },
        'reading data ingested',
      );
      return c.json({ message: 'Upload successful' });
    },
  );

  r.post('/import-sqlite', requireIngestToken(cfg), async (c) => {
    try {
      const body = await c.req.parseBody({ all: true });
      const file = body.file;
      if (!(file instanceof File)) {
        ingestLog.warn(
          { route: '/import-sqlite', ip: clientIp(c) },
          'sqlite import missing multipart "file" field',
        );
        return c.json({ error: 'Expected multipart field "file"' }, 400);
      }
      const deviceId = deviceIdFromMultipartField(body.device_id);
      const result = await importStatisticsSqliteFromUpload(db, file, deviceId);
      ingestLog.info(
        {
          route: '/import-sqlite',
          ip: clientIp(c),
          deviceId,
          booksImported: result.booksImported,
          pageStatsImported: result.pageStatsImported,
        },
        'sqlite statistics imported',
      );
      return c.json({
        message: 'Upload successful',
        booksImported: result.booksImported,
        pageStatsImported: result.pageStatsImported,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      ingestLog.error(
        {
          route: '/import-sqlite',
          ip: clientIp(c),
          err: e instanceof Error ? { message: e.message, stack: e.stack } : e,
        },
        'sqlite import failed',
      );
      return c.json({ error: msg }, 400);
    }
  });

  r.get('/health', (c) => {
    return c.json({
      message: 'ok',
      requiredPluginVersion: cfg.REQUIRED_PLUGIN_VERSION,
    });
  });

  return r;
}
