const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'KB Assistant API',
      version: '1.0.0',
      description: `
## Intelligent Internal Knowledge Assistant API

AI-powered internal knowledge base with RAG pipeline and role-based access control.

### Clearance Levels
| Level | Rank | Description |
|-------|------|-------------|
| GENERAL_NEWBIE | 1 | Standard employees, read general content |
| PERMANENT_STAFF | 2 | Experienced staff, read all non-admin content |
| CONFIDENTIAL_ADMIN | 3 | Administrators, full access |

### Authentication
Use the \`/api/auth/login\` endpoint to obtain a JWT access token, then include it in the \`Authorization: Bearer <token>\` header on all protected endpoints.
      `,
      contact: {
        name: 'API Support',
        email: 'admin@kb-system.local'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained from /api/auth/login'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Unauthorized' }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Validation failed' },
            details: {
              type: 'array',
              items: { type: 'string' },
              example: ['"username" is required']
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            userId: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'admin' },
            clearanceLevel: {
              type: 'string',
              enum: ['GENERAL_NEWBIE', 'PERMANENT_STAFF', 'CONFIDENTIAL_ADMIN']
            },
            department: { type: 'string', example: 'IT' }
          }
        },
        KnowledgeSource: {
          type: 'object',
          properties: {
            source_id: { type: 'integer', example: 1 },
            title: { type: 'string', example: 'Onboarding Guide 2024' },
            content_type: {
              type: 'string',
              enum: ['ONBOARDING_GUIDE', 'POST_MORTEM_ERROR']
            },
            required_clearance: {
              type: 'string',
              enum: ['GENERAL_NEWBIE', 'PERMANENT_STAFF', 'CONFIDENTIAL_ADMIN']
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'ARCHIVED', 'DEPRECATED', 'PENDING_PROCESSING']
            },
            file_path: { type: 'string', example: '/app/storage/uploads/uuid.pdf' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        AuditLog: {
          type: 'object',
          properties: {
            log_id: { type: 'integer', example: 1 },
            user_id: { type: 'integer', example: 1 },
            user_query: { type: 'string', example: 'How to fix Error 500?' },
            ai_output: { type: 'string', example: 'The error occurs when...' },
            accessed_chunk_ids: {
              type: 'array',
              items: { type: 'string', format: 'uuid' }
            },
            created_at: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.routes.js'] // scan all route files for JSDoc comments
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
