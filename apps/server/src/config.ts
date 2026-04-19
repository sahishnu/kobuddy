import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

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
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}

export const config = readEnv();
