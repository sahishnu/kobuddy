/** Minimal OpenAPI 3.1 document for Scalar; extend as routes grow. */
const bookListItemSchema = {
  type: 'object',
  properties: {
    md5: { type: 'string' },
    displayTitle: { type: 'string' },
    hidden: { type: 'boolean' },
    coverUrl: { type: 'string', nullable: true },
  },
} as const;

const bookListPageSchema = {
  type: 'object',
  required: ['items', 'total', 'page', 'pageSize'],
  properties: {
    items: { type: 'array', items: bookListItemSchema },
    total: { type: 'integer' },
    page: { type: 'integer' },
    pageSize: { type: 'integer' },
  },
} as const;

const readingGoalResponseSchema = {
  type: 'object',
  required: ['year', 'books'],
  properties: {
    year: { type: 'integer' },
    books: { type: 'integer', minimum: 1, nullable: true },
  },
} as const;

const loadingQuoteSchema = {
  type: 'object',
  required: ['id', 'text', 'author', 'book', 'enabled', 'sortOrder'],
  properties: {
    id: { type: 'integer' },
    text: { type: 'string' },
    author: { type: 'string' },
    book: { type: 'string' },
    enabled: { type: 'boolean' },
    sortOrder: { type: 'integer' },
  },
} as const;

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
            name: 'page',
            in: 'query',
            description:
              '1-based page; response is BookListPage instead of an array. Paginated requests still honor showHidden (admin) and hiddenOnly.',
            schema: { type: 'integer', minimum: 1 },
          },
          {
            name: 'pageSize',
            in: 'query',
            description: 'Pagination page size (default 25, max 100)',
            schema: { type: 'integer', minimum: 1, maximum: 100 },
          },
          {
            name: 'q',
            in: 'query',
            description:
              'Search across title, custom title, author, series, ISBN, md5',
            schema: { type: 'string' },
          },
          {
            name: 'hiddenOnly',
            in: 'query',
            description: 'Admin only: list hidden books',
            schema: { type: 'string', enum: ['true', 'false'] },
          },
          {
            name: 'shelf',
            in: 'query',
            description:
              'When true: home Recent shelf — omit the current book, only books with meaningful progress (finished or ≥5 pages read)',
            schema: { type: 'string', enum: ['true', 'false'] },
          },
        ],
        responses: {
          '200': {
            description:
              'BookListItem[] when page is omitted; BookListPage when page is set',
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { type: 'array', items: bookListItemSchema },
                    bookListPageSchema,
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/reading-goals/{year}': {
      get: {
        tags: ['settings'],
        summary:
          'Annual books reading goal for a calendar year (public read or admin)',
        parameters: [
          {
            name: 'year',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: readingGoalResponseSchema,
              },
            },
          },
          '401': { description: 'Unauthorized when PUBLIC_READ is false' },
        },
      },
      put: {
        tags: ['settings'],
        summary: 'Set or clear annual books reading goal (admin)',
        parameters: [
          {
            name: 'year',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['books'],
                properties: {
                  books: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 9999,
                    nullable: true,
                    description: 'Pass null to clear the goal',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: readingGoalResponseSchema,
              },
            },
          },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/loading-quotes/random': {
      get: {
        tags: ['settings'],
        summary: 'Random enabled loading quote (public read or admin)',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': { schema: loadingQuoteSchema },
            },
          },
          '404': { description: 'No enabled quotes' },
        },
      },
    },
    '/api/loading-quotes': {
      get: {
        tags: ['settings'],
        summary: 'List all loading quotes (admin)',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['items'],
                  properties: {
                    items: { type: 'array', items: loadingQuoteSchema },
                  },
                },
              },
            },
          },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['settings'],
        summary: 'Create loading quote (admin)',
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': { schema: loadingQuoteSchema },
            },
          },
        },
      },
    },
    '/api/loading-quotes/{id}': {
      put: {
        tags: ['settings'],
        summary: 'Update loading quote (admin)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': { schema: loadingQuoteSchema },
            },
          },
        },
      },
      delete: {
        tags: ['settings'],
        summary: 'Delete loading quote (admin)',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': { description: 'OK' },
        },
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
