/** Minimal OpenAPI 3.1 document for Scalar; extend as routes grow. */
export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'kobuddy',
    version: '0.1.0',
    description: 'Self-hosted KOReader reading stats API',
  },
  paths: {
    '/api/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Admin login',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: { password: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Invalid password' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['auth'],
        summary: 'Current session',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/ingest/device': {
      post: {
        tags: ['ingest'],
        summary: 'Register device (Bearer token)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/ingest/import': {
      post: {
        tags: ['ingest'],
        summary: 'Import reading stats (Bearer token)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/ingest/import-sqlite': {
      post: {
        tags: ['ingest'],
        summary:
          'Import KOReader statistics.sqlite3 file (multipart field `file`, optional `device_id`; Bearer token)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK' },
          '400': { description: 'Invalid file or database' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/books/import-sqlite': {
      post: {
        tags: ['books'],
        summary:
          'Import KOReader statistics.sqlite3 (multipart `file`, optional `device_id`; admin session)',
        responses: {
          '200': { description: 'OK' },
          '400': { description: 'Invalid file or database' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/books': {
      get: {
        tags: ['books'],
        summary: 'List books',
        parameters: [
          {
            name: 'showHidden',
            in: 'query',
            schema: { type: 'string', enum: ['true', 'false'] },
          },
          {
            name: 'sort',
            in: 'query',
            description: 'Use lastOpen for recent-first (e.g. shelf)',
            schema: { type: 'string', enum: ['lastOpen'] },
          },
          {
            name: 'limit',
            in: 'query',
            description:
              'Max rows (1–100); combine with sort=lastOpen for shelf',
            schema: { type: 'integer', minimum: 1, maximum: 100 },
          },
          {
            name: 'shelf',
            in: 'query',
            description:
              'When true: home Recent shelf — omit the current book, only books with meaningful progress (finished or ≥5 pages read)',
            schema: { type: 'string', enum: ['true', 'false'] },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/stats': {
      get: {
        tags: ['stats'],
        summary: 'Aggregated stats (dashboard)',
        parameters: [
          {
            name: 'timeZone',
            in: 'query',
            description:
              'IANA timezone for calendar, streaks, ISO week, and hourly buckets',
            schema: { type: 'string' },
          },
          {
            name: 'tz',
            in: 'query',
            description: 'Alias of timeZone',
            schema: { type: 'string' },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'opaque',
      },
    },
  },
} as const;
