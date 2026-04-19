import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

/**
 * Turbo runs `apps/server` with cwd `apps/server`, while `.env` usually lives at the
 * monorepo root. Walk parents from cwd, then fall back to repo root next to this package.
 */
function resolveEnvPath(): string | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const p = path.join(dir, '.env');
    if (fs.existsSync(p)) return p;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const fromMonorepoRoot = path.resolve(here, '../../../.env');
  if (fs.existsSync(fromMonorepoRoot)) return fromMonorepoRoot;

  return undefined;
}

const envFile = resolveEnvPath();
if (envFile) {
  loadEnv({ path: envFile });
} else {
  loadEnv();
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  HOSTNAME: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATA_PATH: z.string().default('./data'),
  DATABASE_FILE: z.string().default('app.sqlite'),
  MIGRATIONS_PATH: z.string().optional(),
  INGEST_TOKEN: z.string().min(16),
  ADMIN_PASSWORD: z.string().min(8),
  SESSION_SECRET: z.string().min(32),
  PUBLIC_READ: z.coerce.boolean().default(true),
  MAX_COVER_MB: z.coerce.number().positive().default(5),
  AUTO_FETCH_COVERS: z.coerce.boolean().default(false),
  GOOGLE_BOOKS_API_KEY: z.string().optional(),
  REQUIRED_PLUGIN_VERSION: z.string().default('0.1.0'),
});

export type AppConfig = z.infer<typeof envSchema>;

function readEnv(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    if (
      !process.env.INGEST_TOKEN &&
      !process.env.ADMIN_PASSWORD &&
      !process.env.SESSION_SECRET
    ) {
      console.error(
        'Missing secrets. Copy `.env.example` to `.env` at the repository root and set INGEST_TOKEN, ADMIN_PASSWORD, and SESSION_SECRET.',
      );
    }
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}

export const config = readEnv();
