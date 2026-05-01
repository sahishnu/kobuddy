import type { AppConfig } from '../config.js';

/** Deterministic config for integration tests (matches `envSchema` shape). */
export function testAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: 'test',
    HOSTNAME: '0.0.0.0',
    PORT: 3000,
    DATA_PATH: './data',
    DATABASE_FILE: 'app.sqlite',
    MIGRATIONS_PATH: undefined,
    INGEST_TOKEN: 'test-ingest-token-16',
    ADMIN_PASSWORD: 'adminpassword1',
    SESSION_SECRET: '01234567890123456789012345678901',
    PUBLIC_READ: true,
    MAX_COVER_MB: 5,
    AUTO_FETCH_COVERS: false,
    GOOGLE_BOOKS_API_KEY: undefined,
    REQUIRED_PLUGIN_VERSION: '0.1.0',
    READING_GOAL_BOOKS: undefined,
    ...overrides,
  };
}
