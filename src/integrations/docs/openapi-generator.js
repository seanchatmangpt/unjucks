/**
 * Enterprise OpenAPI/Swagger Documentation Generator
 * Automatically generates comprehensive API documentation with enterprise features
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../../lib/observability/logger.js';

export class OpenAPIGenerator {
  constructor(config = {}) {
    this.config = {
      version: '3.0.3',
      title: 'Unjucks Enterprise API',
      description: 'Comprehensive API for Unjucks Enterprise Template Generation Platform',
      contact: {
        name: 'API Support',
        email: 'api-support@unjucks.enterprise',
        url: 'https://docs.unjucks.enterprise'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      },
      servers: [
        {
          url: process.env.API_BASE_URL || 'https://api.unjucks.enterprise',
          description: 'Production server'
        },
        {
          url: 'https://staging-api.unjucks.enterprise',
          description: 'Staging server'
        },
        {
          url: 'http://localhost:3000',
          description: 'Development server'
        }
      ],
      enableExamples: true,
      enableSchemas: true,
      enableSecurity: true,
      enableValidation: true,
      outputFormat: 'json', // json, yaml, both
      outputDir: './docs/api',
      ...config
    };

    this.spec = this.initializeSpec();
    this.paths = new Map();
    this.components = new Map();
    this.security = new Map();
    this.examples = new Map();
    this.middlewareRoutes = new Set();
  }

  initializeSpec() {
    return {
      openapi: this.config.version,
      info: {
        title: this.config.title,
        description: this.config.description,
        version: process.env.API_VERSION || '1.0.0',
        contact: this.config.contact,
        license: this.config.license,
        termsOfService: 'https://unjucks.enterprise/terms'
      },
      servers: this.config.servers,
      paths: {},
      components: {
        schemas: {},
        responses: {},
        parameters: {},
        examples: {},
        requestBodies: {},
        headers: {},
        securitySchemes: {},
        links: {},
        callbacks: {}
      },
      security: [],
      tags: [],
      externalDocs: {
        description: 'Find more info here',
        url: 'https://docs.unjucks.enterprise'
      }
    };
  }

  // Route Documentation
  addPath(method, path, definition) {
    const normalizedPath = this.normalizePath(path);
    
    if (!this.spec.paths[normalizedPath]) {
      this.spec.paths[normalizedPath] = {};
    }

    this.spec.paths[normalizedPath][method.toLowerCase()] = {
      summary: definition.summary || `${method.toUpperCase()} ${normalizedPath}`,
      description: definition.description || '',
      operationId: definition.operationId || this.generateOperationId(method, path),
      tags: definition.tags || [this.extractTagFromPath(path)],
      parameters: definition.parameters || [],
      requestBody: definition.requestBody,
      responses: definition.responses || this.getDefaultResponses(),
      security: definition.security,
      deprecated: definition.deprecated || false,
      ...definition
    };

    logger.debug(`Added API path: ${method.toUpperCase()} ${normalizedPath}`);
  }

  normalizePath(path) {
    // Convert Express-style parameters to OpenAPI format
    return path
      .replace(/:([^/]+)/g, '{$1}')
      .replace(/\/v\d+(?:\.\d+)?\//, '/') // Remove version prefix for documentation
      .replace(/\/+/g, '/'); // Remove duplicate slashes
  }

  generateOperationId(method, path) {
    const pathParts = path.split('/').filter(Boolean);
    const resource = pathParts[pathParts.length - 1] || 'root';
    return `${method.toLowerCase()}${this.toPascalCase(resource)}`;
  }

  extractTagFromPath(path) {
    const parts = path.split('/').filter(Boolean);
    return parts[0] || 'default';
  }

  toPascalCase(str) {
    return str.replace(/(^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
  }

  // Schema Management
  addSchema(name, schema) {
    this.spec.components.schemas[name] = {
      type: 'object',
      ...schema
    };
  }

  // Common Enterprise Schemas
  addEnterpriseSchemas() {
    // User Schema
    this.addSchema('User', {
      type: 'object',
      required: ['id', 'email'],
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: 'Unique user identifier'
        },
        email: {
          type: 'string',
          format: 'email',
          description: 'User email address'
        },
        firstName: {
          type: 'string',
          description: 'User first name'
        },
        lastName: {
          type: 'string',
          description: 'User last name'
        },
        roles: {
          type: 'array',
          items: { type: 'string' },
          description: 'User roles for authorization'
        },
        tenant: {
          type: 'string',
          description: 'Tenant identifier for multi-tenancy'
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          description: 'User creation timestamp'
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          description: 'Last update timestamp'
        }
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'admin@example.com',
        firstName: 'John',
        lastName: 'Doe',
        roles: ['admin', 'user'],
        tenant: 'enterprise-corp',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    });

    // Template Schema
    this.addSchema('Template', {
      type: 'object',
      required: ['id', 'name', 'content'],
      properties: {
        id: {
          type: 'string',
          format: 'uuid',
          description: 'Template unique identifier'
        },
        name: {
          type: 'string',
          description: 'Template name'
        },
        description: {
          type: 'string',
          description: 'Template description'
        },
        content: {
          type: 'string',
          description: 'Template content with Nunjucks syntax'
        },
        variables: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of template variables'
        },
        category: {
          type: 'string',
          description: 'Template category'
        },
        version: {
          type: 'string',
          description: 'Template version'
        },
        authorId: {
          type: 'string',
          format: 'uuid',
          description: 'Template author ID'
        },
        createdAt: {
          type: 'string',
          format: 'date-time'
        },
        updatedAt: {
          type: 'string',
          format: 'date-time'
        }
      },
      example: {
        id: '456e7890-e89b-12d3-a456-426614174000',
        name: 'React Component',
        description: 'Generate React functional component',
        content: 'export const {{name}} = () => {\n  return <div>{{name}}</div>;\n};',
        variables: ['name'],
        category: 'react',
        version: '1.0.0',
        authorId: '123e4567-e89b-12d3-a456-426614174000',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    });

    // Generation Request Schema
    this.addSchema('GenerationRequest', {
      type: 'object',
      required: ['templateId', 'variables'],
      properties: {
        templateId: {
          type: 'string',
          format: 'uuid',
          description: 'Template to use for generation'
        },
        variables: {
          type: 'object',
          description: 'Variables to substitute in template',
          additionalProperties: {
            type: 'string'
          }
        },
        outputFormat: {
          type: 'string',
          enum: ['file', 'string', 'stream'],
          default: 'string',
          description: 'Output format preference'
        },
        options: {
          type: 'object',
          properties: {
            dryRun: {
              type: 'boolean',
              default: false,
              description: 'Whether to perform a dry run'
            },
            validate: {
              type: 'boolean',
              default: true,
              description: 'Whether to validate the output'
            }
          }
        }
      },
      example: {
        templateId: '456e7890-e89b-12d3-a456-426614174000',
        variables: {
          name: 'MyComponent'
        },
        outputFormat: 'string',
        options: {
          dryRun: false,
          validate: true
        }
      }
    });

    // Error Schema
    this.addSchema('Error', {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: {
          type: 'string',
          description: 'Error code'
        },
        message: {
          type: 'string',
          description: 'Error message'
        },
        details: {
          type: 'object',
          description: 'Additional error details'
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'Error timestamp'
        },
        correlationId: {
          type: 'string',
          description: 'Request correlation ID for tracing'
        }
      },
      example: {
        code: 'TEMPLATE_NOT_FOUND',
        message: 'The specified template was not found',
        details: {
          templateId: '456e7890-e89b-12d3-a456-426614174000'
        },
        timestamp: '2024-01-01T00:00:00Z',
        correlationId: 'abc123-def456-ghi789'
      }
    });

    // Pagination Schema
    this.addSchema('PaginationMetadata', {
      type: 'object',
      properties: {
        page: {
          type: 'integer',
          minimum: 1,
          description: 'Current page number'
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Items per page'
        },
        total: {
          type: 'integer',
          description: 'Total number of items'
        },
        pages: {
          type: 'integer',
          description: 'Total number of pages'
        },
        hasNext: {
          type: 'boolean',
          description: 'Whether there are more pages'
        },
        hasPrev: {
          type: 'boolean',
          description: 'Whether there are previous pages'
        }
      }
    });
  }

  // Security Schemes
  addSecuritySchemes() {
    this.spec.components.securitySchemes = {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token authentication'
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key authentication'
      },
      oauth2: {
        type: 'oauth2',
        description: 'OAuth2 authentication',
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://auth.unjucks.enterprise/oauth/authorize',
            tokenUrl: 'https://auth.unjucks.enterprise/oauth/token',
            scopes: {
              read: 'Read access to resources',
              write: 'Write access to resources',
              admin: 'Administrative access'
            }
          }
        }
      },
      saml: {
        type: 'openIdConnect',
        openIdConnectUrl: 'https://auth.unjucks.enterprise/.well-known/openid-configuration',
        description: 'SAML/OIDC authentication'
      }
    };

    // Set global security requirements
    this.spec.security = [
      { bearerAuth: [] },
      { apiKey: [] },
      { oauth2: ['read'] }
    ];
  }

  // Response Templates
  getDefaultResponses() {
    return {
      '200': {
        description: 'Successful operation',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                data: { type: 'object' },
                metadata: { $ref: '#/components/schemas/PaginationMetadata' }
              }
            }
          }
        }
      },
      '400': {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      '401': {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      '403': {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      '404': {
        description: 'Not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      '500': {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      }
    };
  }

  // Auto-generation from Express routes
  analyzeExpressApp(app) {
    if (!app._router) {
      logger.warn('No Express router found for analysis');
      return;
    }

    const routes = this.extractRoutes(app._router);
    
    for (const route of routes) {
      this.addRouteFromExpress(route);
    }

    logger.info(`Analyzed ${routes.length} Express routes`);
  }

  extractRoutes(router, basePath = '') {
    const routes = [];
    
    if (router.stack) {
      for (const layer of router.stack) {
        if (layer.route) {
          // Regular route
          const path = basePath + layer.route.path;
          for (const method of Object.keys(layer.route.methods)) {
            routes.push({
              method: method.toUpperCase(),
              path,
              handler: layer.route.stack[0]?.handle
            });
          }
        } else if (layer.name === 'router') {
          // Nested router
          const nestedPath = basePath + (layer.regexp.source.match(/^\^\\?(.+?)\\?\$/) || ['', ''])[1];
          routes.push(...this.extractRoutes(layer.handle, nestedPath));
        }
      }
    }
    
    return routes;
  }

  addRouteFromExpress(route) {
    // Extract documentation from route handler comments or metadata
    const documentation = this.extractDocumentationFromHandler(route.handler);
    
    this.addPath(route.method, route.path, {
      summary: documentation.summary || `${route.method} ${route.path}`,
      description: documentation.description || '',
      tags: documentation.tags || [this.extractTagFromPath(route.path)],
      parameters: this.extractParameters(route.path),
      responses: this.getDefaultResponses(),
      ...documentation
    });
  }

  extractDocumentationFromHandler(handler) {
    // This would extract JSDoc comments or metadata from the handler function
    // For now, return empty documentation
    return {};
  }

  extractParameters(path) {
    const parameters = [];
    const pathParams = path.match(/{([^}]+)}/g);
    
    if (pathParams) {
      for (const param of pathParams) {
        const paramName = param.slice(1, -1);
        parameters.push({
          name: paramName,
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${paramName} parameter`
        });
      }
    }
    
    return parameters;
  }

  // API Endpoints Documentation
  documentEnterpriseEndpoints() {
    // Authentication endpoints
    this.addPath('POST', '/auth/login', {
      tags: ['Authentication'],
      summary: 'User login',
      description: 'Authenticate user with email and password',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', format: 'password' }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string' },
                  user: { $ref: '#/components/schemas/User' },
                  expiresAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        }
      },
      security: []
    });

    // Template endpoints
    this.addPath('GET', '/templates', {
      tags: ['Templates'],
      summary: 'List templates',
      description: 'Retrieve a paginated list of templates',
      parameters: [
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, default: 1 }
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
        },
        {
          name: 'category',
          in: 'query',
          schema: { type: 'string' }
        }
      ],
      responses: {
        '200': {
          description: 'Templates retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Template' }
                  },
                  metadata: { $ref: '#/components/schemas/PaginationMetadata' }
                }
              }
            }
          }
        }
      }
    });

    this.addPath('POST', '/templates/{id}/generate', {
      tags: ['Templates'],
      summary: 'Generate from template',
      description: 'Generate code/content from a template',
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'Template ID'
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/GenerationRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'Generation successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  result: { type: 'string' },
                  metadata: {
                    type: 'object',
                    properties: {
                      generatedAt: { type: 'string', format: 'date-time' },
                      templateVersion: { type: 'string' },
                      executionTime: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  }

  // Generate and save documentation
  async generate() {
    // Add enterprise schemas and security
    this.addEnterpriseSchemas();
    this.addSecuritySchemes();
    this.documentEnterpriseEndpoints();

    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir, { recursive: true });

    // Generate JSON format
    if (this.config.outputFormat === 'json' || this.config.outputFormat === 'both') {
      const jsonPath = path.join(this.config.outputDir, 'openapi.json');
      await fs.writeFile(jsonPath, JSON.stringify(this.spec, null, 2));
      logger.info(`OpenAPI JSON generated: ${jsonPath}`);
    }

    // Generate YAML format
    if (this.config.outputFormat === 'yaml' || this.config.outputFormat === 'both') {
      const yamlPath = path.join(this.config.outputDir, 'openapi.yaml');
      const yaml = this.convertToYaml(this.spec);
      await fs.writeFile(yamlPath, yaml);
      logger.info(`OpenAPI YAML generated: ${yamlPath}`);
    }

    // Generate HTML documentation
    await this.generateHtmlDocs();

    return this.spec;
  }

  convertToYaml(obj) {
    // Simple YAML conversion - use a proper YAML library in production
    return JSON.stringify(obj, null, 2)
      .replace(/"/g, '')
      .replace(/,$/gm, '')
      .replace(/^(\s*)"([^"]+)":\s*/gm, '$1$2: ');
  }

  async generateHtmlDocs() {
    const htmlContent = this.generateSwaggerUi();
    const htmlPath = path.join(this.config.outputDir, 'index.html');
    await fs.writeFile(htmlPath, htmlContent);
    logger.info(`Swagger UI generated: ${htmlPath}`);
  }

  generateSwaggerUi() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${this.config.title} - API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: './openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;
  }

  // Validation
  validate() {
    const errors = [];
    
    // Basic validation
    if (!this.spec.info.title) {
      errors.push('Missing API title');
    }
    
    if (!this.spec.info.version) {
      errors.push('Missing API version');
    }
    
    if (Object.keys(this.spec.paths).length === 0) {
      errors.push('No API paths defined');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  getSpec() {
    return this.spec;
  }

  getMetrics() {
    return {
      paths: Object.keys(this.spec.paths).length,
      operations: this.countOperations(),
      schemas: Object.keys(this.spec.components.schemas).length,
      securitySchemes: Object.keys(this.spec.components.securitySchemes).length,
      tags: this.spec.tags.length
    };
  }

  countOperations() {
    let count = 0;
    for (const pathItem of Object.values(this.spec.paths)) {
      count += Object.keys(pathItem).filter(key => 
        ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(key)
      ).length;
    }
    return count;
  }
}

export default OpenAPIGenerator;