import { zValidator } from '@hono/zod-validator';
import { devicePayloadSchema, ingestPayloadSchema } from '@kobuddy/common';
import { Hono } from 'hono';
import type { z } from 'zod';
import type { AppConfig } from '../config.js';
import type { DbClient } from '../lib/db.js';
import { requireIngestToken } from '../middleware/require-bearer.js';
import {
  ingestReadingData,
  registerDevice,
} from '../services/ingest-service.js';

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

export function ingestRouter(cfg: AppConfig, db: DbClient) {
  const r = new Hono();

  const deviceBody = withPluginVersion(cfg, devicePayloadSchema);
  const importBody = withPluginVersion(cfg, ingestPayloadSchema);

  r.post(
    '/device',
    requireIngestToken(cfg),
    zValidator('json', deviceBody),
    async (c) => {
      const body = c.req.valid('json');
      await registerDevice(db, body.id, body.model);
      return c.json({ message: 'Device registered successfully' });
    },
  );

  r.post(
    '/import',
    requireIngestToken(cfg),
    zValidator('json', importBody),
    async (c) => {
      const body = c.req.valid('json');
      await ingestReadingData(db, body.books, body.stats);
      return c.json({ message: 'Upload successful' });
    },
  );

  r.get('/health', (c) => {
    return c.json({
      message: 'ok',
      requiredPluginVersion: cfg.REQUIRED_PLUGIN_VERSION,
    });
  });

  return r;
}
