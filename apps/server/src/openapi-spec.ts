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
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/stats': {
      get: {
        tags: ['stats'],
        summary: 'Aggregated stats',
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
