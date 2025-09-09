/**
 * OpenAPI 3.0 Documentation Generator
 * Automatically generates and validates OpenAPI specifications
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { mkdirSync } from 'fs';
import * as yaml from 'yaml';

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
  termsOfService?: string;
}

export interface OpenAPIServer {
  url: string;
  description?: string;
  variables?: Record<string, {
    enum?: string[];
    default: string;
    description?: string;
  }>;
}

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  schema: OpenAPISchema;
  example?: any;
  examples?: Record<string, { value: any; summary?: string; description?: string }>;
}

export interface OpenAPISchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  format?: string;
  items?: OpenAPISchema;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  enum?: any[];
  example?: any;
  description?: string;
  $ref?: string;
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  not?: OpenAPISchema;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

export interface OpenAPIResponse {
  description: string;
  headers?: Record<string, {
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    schema: OpenAPISchema;
    example?: any;
  }>;
  content?: Record<string, {
    schema: OpenAPISchema;
    example?: any;
    examples?: Record<string, { value: any; summary?: string; description?: string }>;
  }>;
}

export interface OpenAPIOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: (OpenAPIParameter | { $ref: string })[];
  requestBody?: {
    description?: string;
    content: Record<string, {
      schema: OpenAPISchema;
      example?: any;
      examples?: Record<string, { value: any; summary?: string; description?: string }>;
    }>;
    required?: boolean;
  };
  responses: Record<string, OpenAPIResponse>;
  deprecated?: boolean;
  security?: Record<string, string[]>[];
  servers?: OpenAPIServer[];
}

export interface OpenAPIPath {
  summary?: string;
  description?: string;
  get?: OpenAPIOperation;
  put?: OpenAPIOperation;
  post?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  trace?: OpenAPIOperation;
  servers?: OpenAPIServer[];
  parameters?: (OpenAPIParameter | { $ref: string })[];
}

export interface OpenAPIDocument {
  openapi: '3.0.0' | '3.0.1' | '3.0.2' | '3.0.3' | '3.1.0';
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPath>;
  components?: {
    schemas?: Record<string, OpenAPISchema>;
    responses?: Record<string, OpenAPIResponse>;
    parameters?: Record<string, OpenAPIParameter>;
    examples?: Record<string, { value: any; summary?: string; description?: string }>;
    requestBodies?: Record<string, {
      description?: string;
      content: Record<string, { schema: OpenAPISchema; example?: any }>;
      required?: boolean;
    }>;
    headers?: Record<string, {
      description?: string;
      required?: boolean;
      schema: OpenAPISchema;
      example?: any;
    }>;
    securitySchemes?: Record<string, {
      type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
      description?: string;
      name?: string;
      in?: 'query' | 'header' | 'cookie';
      scheme?: string;
      bearerFormat?: string;
      flows?: Record<string, any>;
      openIdConnectUrl?: string;
    }>;
  };
  security?: Record<string, string[]>[];
  tags?: {
    name: string;
    description?: string;
    externalDocs?: {
      description?: string;
      url: string;
    };
  }[];
  externalDocs?: {
    description?: string;
    url: string;
  };
}

export interface APIEndpoint {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: any[];
  requestBody?: any;
  responses?: Record<string, any>;
  security?: any[];
}

export interface APIGeneratorConfig {
  inputDir: string;
  outputDir: string;
  apiTitle: string;
  apiVersion: string;
  apiDescription?: string;
  serverUrl?: string;
  generateExamples?: boolean;
  validateSpec?: boolean;
  formatOutput?: 'yaml' | 'json' | 'both';
}

export class OpenAPIGenerator {
  private config: APIGeneratorConfig;
  private document: OpenAPIDocument;
  private endpoints: APIEndpoint[] = [];

  constructor(config: APIGeneratorConfig) {
    this.config = config;
    this.ensureOutputDirectory();
    this.initializeDocument();
  }

  private ensureOutputDirectory(): void {
    try {
      mkdirSync(this.config.outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private initializeDocument(): void {
    this.document = {
      openapi: '3.0.3',
      info: {
        title: this.config.apiTitle,
        version: this.config.apiVersion,
        description: this.config.apiDescription || 'API Documentation',
        contact: {
          name: 'API Team',
          email: 'api-team@company.com'
        }
      },
      servers: this.config.serverUrl ? [{
        url: this.config.serverUrl,
        description: 'Production server'
      }] : [],
      paths: {},
      components: {
        schemas: {},
        responses: this.getCommonResponses(),
        parameters: this.getCommonParameters(),
        securitySchemes: this.getSecuritySchemes()
      },
      security: [{ 'BearerAuth': [] }],
      tags: []
    };
  }

  public generateDocumentation(): void {
    console.log('🔄 Starting OpenAPI documentation generation...');

    // Discover API endpoints
    this.discoverEndpoints();

    // Generate OpenAPI paths
    this.generatePaths();

    // Generate schemas
    this.generateSchemas();

    // Generate tags
    this.generateTags();

    // Validate specification
    if (this.config.validateSpec) {
      this.validateSpecification();
    }

    // Write output files
    this.writeDocumentation();

    console.log('✅ OpenAPI documentation generation complete!');
  }

  private discoverEndpoints(): void {
    console.log('🔍 Discovering API endpoints...');

    const sourceFiles = this.findSourceFiles();
    
    for (const file of sourceFiles) {
      this.extractEndpointsFromFile(file);
    }

    console.log(`📊 Discovered ${this.endpoints.length} API endpoints`);
  }

  private findSourceFiles(): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.js', '.py', '.go', '.java', '.rb', '.php'];

    const scanDirectory = (dir: string): void => {
      try {
        const items = readdirSync(dir);
        
        for (const item of items) {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            scanDirectory(fullPath);
          } else if (stat.isFile() && extensions.includes(extname(item))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Directory might not exist or be inaccessible
      }
    };

    scanDirectory(this.config.inputDir);
    return files;
  }

  private extractEndpointsFromFile(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Extract Express.js routes
      this.extractExpressRoutes(content, filePath);
      
      // Extract FastAPI routes
      this.extractFastAPIRoutes(content, filePath);
      
      // Extract Spring Boot routes
      this.extractSpringBootRoutes(content, filePath);
      
      // Extract decorator-based routes
      this.extractDecoratorRoutes(content, filePath);
      
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
    }
  }

  private extractExpressRoutes(content: string, filePath: string): void {
    // Patterns for Express.js routes
    const patterns = [
      /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,.*?(?:\/\*\*(.*?)\*\/)?/gs,
      /(?:router|app)\.route\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.(get|post|put|delete|patch)/gs
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const method = match[1]?.toLowerCase();
        const path = match[2] || match[1]; // Handle .route() syntax
        const docComment = match[3];

        if (method && path) {
          this.endpoints.push(this.createEndpoint(method, path, docComment, filePath));
        }
      }
    }
  }

  private extractFastAPIRoutes(content: string, filePath: string): void {
    // Patterns for FastAPI routes
    const patterns = [
      /@app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const method = match[1].toLowerCase();
        const path = match[2];

        this.endpoints.push(this.createEndpoint(method, path, null, filePath));
      }
    }
  }

  private extractSpringBootRoutes(content: string, filePath: string): void {
    // Patterns for Spring Boot routes
    const patterns = [
      /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /@RequestMapping\s*\(\s*.*?value\s*=\s*['"`]([^'"`]+)['"`].*?method\s*=\s*RequestMethod\.(\w+)/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let method: string;
        let path: string;

        if (match[1].includes('Mapping')) {
          method = match[1].replace('Mapping', '').toLowerCase();
          path = match[2];
        } else {
          method = match[2].toLowerCase();
          path = match[1];
        }

        this.endpoints.push(this.createEndpoint(method, path, null, filePath));
      }
    }
  }

  private extractDecoratorRoutes(content: string, filePath: string): void {
    // Patterns for decorator-based routes (NestJS, etc.)
    const patterns = [
      /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /@(Get|Post|Put|Delete|Patch)\s*\(\s*\)/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const method = match[1].toLowerCase();
        const path = match[2] || '/';

        this.endpoints.push(this.createEndpoint(method, path, null, filePath));
      }
    }
  }

  private createEndpoint(method: string, path: string, docComment: string | null, filePath: string): APIEndpoint {
    const endpoint: APIEndpoint = {
      path: this.normalizePath(path),
      method: method.toLowerCase(),
      summary: this.extractSummaryFromComment(docComment) || `${method.toUpperCase()} ${path}`,
      description: this.extractDescriptionFromComment(docComment),
      tags: this.inferTagsFromPath(path, filePath),
      parameters: this.inferParameters(path),
      responses: this.getDefaultResponses(method)
    };

    return endpoint;
  }

  private normalizePath(path: string): string {
    // Convert various parameter formats to OpenAPI format
    return path
      .replace(/:(\w+)/g, '{$1}')  // Express :param -> {param}
      .replace(/<(\w+)>/g, '{$1}') // Flask <param> -> {param}
      .replace(/\{(\w+):[^}]+\}/g, '{$1}'); // Remove type constraints
  }

  private extractSummaryFromComment(comment: string | null): string | undefined {
    if (!comment) return undefined;
    
    const lines = comment.split('\n').map(line => line.trim());
    const summaryLine = lines.find(line => line && !line.startsWith('@'));
    
    return summaryLine?.replace(/\*/g, '').trim();
  }

  private extractDescriptionFromComment(comment: string | null): string | undefined {
    if (!comment) return undefined;
    
    const lines = comment.split('\n')
      .map(line => line.trim().replace(/^\*\s?/, ''))
      .filter(line => line && !line.startsWith('@'));
    
    if (lines.length > 1) {
      return lines.slice(1).join('\n').trim();
    }
    
    return undefined;
  }

  private inferTagsFromPath(path: string, filePath: string): string[] {
    const tags: string[] = [];
    
    // Extract from path segments
    const pathSegments = path.split('/').filter(segment => segment && !segment.startsWith('{'));
    if (pathSegments.length > 0) {
      tags.push(pathSegments[0]);
    }
    
    // Extract from file path
    const fileName = basename(filePath, extname(filePath));
    if (fileName.includes('controller') || fileName.includes('route') || fileName.includes('handler')) {
      const tag = fileName.replace(/(controller|route|handler|s)$/i, '');
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    }
    
    return tags.length > 0 ? tags : ['default'];
  }

  private inferParameters(path: string): OpenAPIParameter[] {
    const parameters: OpenAPIParameter[] = [];
    const pathParams = path.match(/\{(\w+)\}/g);
    
    if (pathParams) {
      for (const param of pathParams) {
        const name = param.slice(1, -1); // Remove { }
        parameters.push({
          name,
          in: 'path',
          required: true,
          description: `The ${name} identifier`,
          schema: {
            type: 'string'
          }
        });
      }
    }
    
    return parameters;
  }

  private getDefaultResponses(method: string): Record<string, OpenAPIResponse> {
    const responses: Record<string, OpenAPIResponse> = {
      '400': { $ref: '#/components/responses/BadRequest' } as any,
      '401': { $ref: '#/components/responses/Unauthorized' } as any,
      '403': { $ref: '#/components/responses/Forbidden' } as any,
      '500': { $ref: '#/components/responses/InternalServerError' } as any
    };

    switch (method.toLowerCase()) {
      case 'get':
        responses['200'] = {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        };
        responses['404'] = { $ref: '#/components/responses/NotFound' } as any;
        break;

      case 'post':
        responses['201'] = {
          description: 'Created successfully',
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        };
        responses['409'] = { $ref: '#/components/responses/Conflict' } as any;
        break;

      case 'put':
      case 'patch':
        responses['200'] = {
          description: 'Updated successfully',
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        };
        responses['404'] = { $ref: '#/components/responses/NotFound' } as any;
        break;

      case 'delete':
        responses['204'] = {
          description: 'Deleted successfully'
        };
        responses['404'] = { $ref: '#/components/responses/NotFound' } as any;
        break;
    }

    return responses;
  }

  private generatePaths(): void {
    console.log('🛣️  Generating OpenAPI paths...');

    for (const endpoint of this.endpoints) {
      if (!this.document.paths[endpoint.path]) {
        this.document.paths[endpoint.path] = {};
      }

      this.document.paths[endpoint.path][endpoint.method as keyof OpenAPIPath] = {
        tags: endpoint.tags,
        summary: endpoint.summary,
        description: endpoint.description,
        operationId: this.generateOperationId(endpoint),
        parameters: endpoint.parameters,
        requestBody: this.generateRequestBody(endpoint),
        responses: endpoint.responses,
        security: endpoint.security
      };
    }
  }

  private generateOperationId(endpoint: APIEndpoint): string {
    const pathParts = endpoint.path.split('/').filter(part => part && !part.startsWith('{'));
    const resource = pathParts[pathParts.length - 1] || 'root';
    return `${endpoint.method}${resource.charAt(0).toUpperCase()}${resource.slice(1)}`;
  }

  private generateRequestBody(endpoint: APIEndpoint): any {
    if (['post', 'put', 'patch'].includes(endpoint.method)) {
      return {
        description: `${endpoint.method.toUpperCase()} request body`,
        content: {
          'application/json': {
            schema: {
              type: 'object'
            }
          }
        },
        required: true
      };
    }
    return undefined;
  }

  private generateSchemas(): void {
    console.log('📋 Generating OpenAPI schemas...');

    // Generate common schemas
    if (this.document.components?.schemas) {
      this.document.components.schemas['Error'] = {
        type: 'object',
        required: ['message'],
        properties: {
          message: {
            type: 'string',
            description: 'Error message'
          },
          code: {
            type: 'string',
            description: 'Error code'
          },
          details: {
            type: 'object',
            description: 'Additional error details'
          }
        }
      };

      this.document.components.schemas['PaginationMeta'] = {
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
            minimum: 0,
            description: 'Total number of items'
          },
          totalPages: {
            type: 'integer',
            minimum: 0,
            description: 'Total number of pages'
          }
        }
      };

      this.document.components.schemas['PaginatedResponse'] = {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object'
            }
          },
          meta: {
            $ref: '#/components/schemas/PaginationMeta'
          }
        }
      };
    }
  }

  private generateTags(): void {
    console.log('🏷️  Generating OpenAPI tags...');

    const tagSet = new Set<string>();
    
    for (const endpoint of this.endpoints) {
      if (endpoint.tags) {
        endpoint.tags.forEach(tag => tagSet.add(tag));
      }
    }

    this.document.tags = Array.from(tagSet).map(tag => ({
      name: tag,
      description: `${tag.charAt(0).toUpperCase()}${tag.slice(1)} related operations`
    }));
  }

  private getCommonResponses(): Record<string, OpenAPIResponse> {
    return {
      'BadRequest': {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      'Unauthorized': {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      'Forbidden': {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      'NotFound': {
        description: 'Not Found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      'Conflict': {
        description: 'Conflict',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      'InternalServerError': {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      }
    };
  }

  private getCommonParameters(): Record<string, OpenAPIParameter> {
    return {
      'PageParameter': {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1
        }
      },
      'LimitParameter': {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20
        }
      },
      'SortParameter': {
        name: 'sort',
        in: 'query',
        description: 'Sort field and direction (e.g., name:asc, created_at:desc)',
        required: false,
        schema: {
          type: 'string'
        }
      }
    };
  }

  private getSecuritySchemes(): Record<string, any> {
    return {
      'BearerAuth': {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Bearer token authentication'
      },
      'ApiKeyAuth': {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key authentication'
      },
      'OAuth2': {
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://example.com/oauth/authorize',
            tokenUrl: 'https://example.com/oauth/token',
            scopes: {
              'read': 'Read access to resources',
              'write': 'Write access to resources',
              'admin': 'Administrative access'
            }
          }
        }
      }
    };
  }

  private validateSpecification(): void {
    console.log('✅ Validating OpenAPI specification...');

    const errors: string[] = [];

    // Basic validation
    if (!this.document.info.title) {
      errors.push('Missing required field: info.title');
    }

    if (!this.document.info.version) {
      errors.push('Missing required field: info.version');
    }

    if (Object.keys(this.document.paths).length === 0) {
      errors.push('No paths defined in specification');
    }

    // Validate paths
    for (const [path, pathItem] of Object.entries(this.document.paths)) {
      if (!path.startsWith('/')) {
        errors.push(`Path must start with '/': ${path}`);
      }

      for (const [method, operation] of Object.entries(pathItem)) {
        if (method === 'parameters' || method === 'servers') continue;
        
        const op = operation as OpenAPIOperation;
        if (!op.responses) {
          errors.push(`Missing responses for ${method.toUpperCase()} ${path}`);
        } else if (!op.responses['200'] && !op.responses['201'] && !op.responses['204']) {
          errors.push(`Missing success response for ${method.toUpperCase()} ${path}`);
        }
      }
    }

    if (errors.length > 0) {
      console.error('❌ OpenAPI validation errors:');
      errors.forEach(error => console.error(`   - ${error}`));
      throw new Error(`OpenAPI validation failed with ${errors.length} errors`);
    }

    console.log('✅ OpenAPI specification is valid!');
  }

  private writeDocumentation(): void {
    console.log('💾 Writing OpenAPI documentation...');

    const formats = this.config.formatOutput === 'both' 
      ? ['yaml', 'json'] 
      : [this.config.formatOutput || 'yaml'];

    for (const format of formats) {
      const filename = `openapi.${format}`;
      const filepath = join(this.config.outputDir, filename);

      let content: string;
      if (format === 'yaml') {
        content = yaml.stringify(this.document, {
          indent: 2,
          lineWidth: 100,
          minContentWidth: 0
        });
      } else {
        content = JSON.stringify(this.document, null, 2);
      }

      writeFileSync(filepath, content, 'utf-8');
      console.log(`📝 Generated ${format.toUpperCase()}: ${filepath}`);
    }

    // Generate HTML documentation if requested
    if (this.config.generateExamples) {
      this.generateHTMLDocumentation();
    }
  }

  private generateHTMLDocumentation(): void {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>${this.document.info.title} - API Documentation</title>
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

    const htmlPath = join(this.config.outputDir, 'index.html');
    writeFileSync(htmlPath, htmlContent, 'utf-8');
    console.log(`📝 Generated HTML documentation: ${htmlPath}`);
  }
}

// CLI interface
if (require.main === module) {
  const config: APIGeneratorConfig = {
    inputDir: process.env.INPUT_DIR || 'src',
    outputDir: process.env.OUTPUT_DIR || 'docs/api',
    apiTitle: process.env.API_TITLE || 'API Documentation',
    apiVersion: process.env.API_VERSION || '1.0.0',
    apiDescription: process.env.API_DESCRIPTION,
    serverUrl: process.env.SERVER_URL,
    generateExamples: process.env.GENERATE_EXAMPLES === 'true',
    validateSpec: process.env.VALIDATE_SPEC !== 'false',
    formatOutput: (process.env.FORMAT_OUTPUT as 'yaml' | 'json' | 'both') || 'both'
  };

  const generator = new OpenAPIGenerator(config);
  generator.generateDocumentation();
}