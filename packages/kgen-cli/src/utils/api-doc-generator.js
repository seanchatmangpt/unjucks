/**
 * API Documentation Generator
 * 
 * Generates comprehensive API documentation for knowledge packs.
 */

export class APIDocGenerator {
  constructor() {
    this.templates = new Map();
    this.loadTemplates();
  }

  async generateDocumentation(filter = null) {
    const apis = await this.discoverAPIs(filter);
    const endpoints = await this.generateEndpoints(apis);
    const authentication = this.generateAuthDocs();
    const rateLimit = this.generateRateLimitDocs();
    const sdks = this.generateSDKDocs();
    const playground = this.generatePlaygroundDocs();
    
    return {
      totalAPIs: apis.length,
      endpoints,
      authentication,
      rateLimit,
      sdks,
      playground,
      resources: this.generateResourceDocs(),
      generated: new Date().toISOString()
    };
  }

  async discoverAPIs(filter) {
    // In production, this would scan actual knowledge packs for API definitions
    const mockAPIs = [
      {
        id: 'auth-api',
        name: 'Authentication API',
        version: '2.1.0',
        category: 'security',
        endpoints: 12,
        baseUrl: 'https://api.kgen.io/auth'
      },
      {
        id: 'data-api',
        name: 'Data Processing API',
        version: '1.5.2', 
        category: 'data-processing',
        endpoints: 28,
        baseUrl: 'https://api.kgen.io/data'
      },
      {
        id: 'template-api',
        name: 'Template Management API',
        version: '3.0.1',
        category: 'templates',
        endpoints: 15,
        baseUrl: 'https://api.kgen.io/templates'
      },
      {
        id: 'analytics-api',
        name: 'Analytics API',
        version: '1.2.0',
        category: 'analytics',
        endpoints: 22,
        baseUrl: 'https://api.kgen.io/analytics'
      }
    ];
    
    if (filter) {
      return mockAPIs.filter(api => 
        api.category.includes(filter) || 
        api.name.toLowerCase().includes(filter.toLowerCase())
      );
    }
    
    return mockAPIs;
  }

  async generateEndpoints(apis) {
    const allEndpoints = [];
    
    for (const api of apis) {
      const endpoints = this.generateAPIEndpoints(api);
      allEndpoints.push(...endpoints);
    }
    
    return allEndpoints;
  }

  generateAPIEndpoints(api) {
    const endpointTemplates = {
      'auth-api': [
        { method: 'POST', path: '/login', description: 'Authenticate user' },
        { method: 'POST', path: '/logout', description: 'End user session' },
        { method: 'POST', path: '/refresh', description: 'Refresh access token' },
        { method: 'GET', path: '/user', description: 'Get current user info' },
        { method: 'PUT', path: '/user', description: 'Update user profile' },
        { method: 'POST', path: '/register', description: 'Register new user' },
        { method: 'POST', path: '/forgot-password', description: 'Request password reset' },
        { method: 'POST', path: '/reset-password', description: 'Reset password with token' },
        { method: 'GET', path: '/permissions', description: 'Get user permissions' },
        { method: 'POST', path: '/2fa/enable', description: 'Enable two-factor auth' },
        { method: 'POST', path: '/2fa/verify', description: 'Verify 2FA token' },
        { method: 'DELETE', path: '/sessions/{id}', description: 'Revoke session' }
      ],
      'data-api': [
        { method: 'GET', path: '/datasets', description: 'List datasets' },
        { method: 'POST', path: '/datasets', description: 'Create dataset' },
        { method: 'GET', path: '/datasets/{id}', description: 'Get dataset details' },
        { method: 'PUT', path: '/datasets/{id}', description: 'Update dataset' },
        { method: 'DELETE', path: '/datasets/{id}', description: 'Delete dataset' },
        { method: 'POST', path: '/datasets/{id}/upload', description: 'Upload data' },
        { method: 'GET', path: '/datasets/{id}/download', description: 'Download dataset' },
        { method: 'POST', path: '/transform', description: 'Transform data' },
        { method: 'GET', path: '/transform/{jobId}', description: 'Get transform job status' },
        { method: 'POST', path: '/validate', description: 'Validate data schema' },
        { method: 'GET', path: '/schema/{id}', description: 'Get data schema' },
        { method: 'POST', path: '/export', description: 'Export processed data' }
      ],
      'template-api': [
        { method: 'GET', path: '/templates', description: 'List all templates' },
        { method: 'POST', path: '/templates', description: 'Create new template' },
        { method: 'GET', path: '/templates/{id}', description: 'Get template details' },
        { method: 'PUT', path: '/templates/{id}', description: 'Update template' },
        { method: 'DELETE', path: '/templates/{id}', description: 'Delete template' },
        { method: 'POST', path: '/templates/{id}/render', description: 'Render template' },
        { method: 'GET', path: '/templates/{id}/versions', description: 'List template versions' },
        { method: 'POST', path: '/templates/{id}/validate', description: 'Validate template' },
        { method: 'GET', path: '/categories', description: 'List template categories' },
        { method: 'POST', path: '/templates/{id}/publish', description: 'Publish template' },
        { method: 'POST', path: '/templates/{id}/clone', description: 'Clone template' },
        { method: 'GET', path: '/templates/{id}/usage', description: 'Get template usage stats' }
      ]
    };
    
    const templates = endpointTemplates[api.id] || [];
    
    return templates.map(template => ({
      api: api.id,
      method: template.method,
      path: template.path,
      fullUrl: `${api.baseUrl}${template.path}`,
      description: template.description,
      parameters: this.generateParameters(template),
      responses: this.generateResponses(template),
      examples: this.generateExamples(template),
      rateLimit: this.getEndpointRateLimit(template),
      authentication: this.getEndpointAuth(template)
    }));
  }

  generateParameters(endpoint) {
    // Generate realistic parameters based on endpoint
    const commonParams = {
      query: [
        { name: 'page', type: 'integer', description: 'Page number for pagination' },
        { name: 'limit', type: 'integer', description: 'Number of items per page' },
        { name: 'sort', type: 'string', description: 'Sort field and direction' }
      ],
      headers: [
        { name: 'Authorization', type: 'string', required: true, description: 'Bearer token' },
        { name: 'Content-Type', type: 'string', description: 'Request content type' },
        { name: 'Accept', type: 'string', description: 'Accepted response type' }
      ]
    };
    
    let pathParams = [];
    if (endpoint.path.includes('{id}')) {
      pathParams.push({ name: 'id', type: 'string', required: true, description: 'Resource identifier' });
    }
    if (endpoint.path.includes('{jobId}')) {
      pathParams.push({ name: 'jobId', type: 'string', required: true, description: 'Job identifier' });
    }
    
    return {
      path: pathParams,
      query: endpoint.method === 'GET' ? commonParams.query : [],
      headers: commonParams.headers,
      body: this.generateBodySchema(endpoint)
    };
  }

  generateBodySchema(endpoint) {
    if (['GET', 'DELETE'].includes(endpoint.method)) return null;
    
    // Generate realistic body schemas
    const schemas = {
      '/login': {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 }
        },
        required: ['email', 'password']
      },
      '/datasets': {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          schema: { type: 'object' },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['name', 'schema']
      },
      '/templates': {
        type: 'object',
        properties: {
          name: { type: 'string' },
          content: { type: 'string' },
          variables: { type: 'object' },
          category: { type: 'string' }
        },
        required: ['name', 'content']
      }
    };
    
    return schemas[endpoint.path] || {
      type: 'object',
      properties: {
        data: { type: 'object', description: 'Request data' }
      }
    };
  }

  generateResponses(endpoint) {
    return {
      '200': {
        description: 'Success',
        schema: this.generateResponseSchema(endpoint),
        example: this.generateResponseExample(endpoint)
      },
      '400': {
        description: 'Bad Request',
        schema: { type: 'object', properties: { error: { type: 'string' } } }
      },
      '401': {
        description: 'Unauthorized',
        schema: { type: 'object', properties: { error: { type: 'string' } } }
      },
      '404': {
        description: 'Not Found',
        schema: { type: 'object', properties: { error: { type: 'string' } } }
      },
      '500': {
        description: 'Internal Server Error',
        schema: { type: 'object', properties: { error: { type: 'string' } } }
      }
    };
  }

  generateResponseSchema(endpoint) {
    if (endpoint.method === 'DELETE') {
      return { type: 'object', properties: { success: { type: 'boolean' } } };
    }
    
    return {
      type: 'object',
      properties: {
        data: { type: 'object' },
        metadata: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' }
          }
        }
      }
    };
  }

  generateResponseExample(endpoint) {
    return {
      data: { id: '123', name: 'Example Resource' },
      metadata: { page: 1, limit: 20, total: 100 }
    };
  }

  generateExamples(endpoint) {
    return {
      curl: this.generateCurlExample(endpoint),
      javascript: this.generateJavaScriptExample(endpoint),
      python: this.generatePythonExample(endpoint)
    };
  }

  generateCurlExample(endpoint) {
    const method = endpoint.method;
    const url = endpoint.fullUrl;
    
    let curl = `curl -X ${method} "${url}"`;
    curl += ` \\\n  -H "Authorization: Bearer YOUR_TOKEN"`;
    curl += ` \\\n  -H "Content-Type: application/json"`;
    
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      curl += ` \\\n  -d '{"key": "value"}'`;
    }
    
    return curl;
  }

  generateJavaScriptExample(endpoint) {
    return `
const response = await fetch('${endpoint.fullUrl}', {
  method: '${endpoint.method}',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }${['POST', 'PUT', 'PATCH'].includes(endpoint.method) ? ',\n  body: JSON.stringify({ key: "value" })' : ''}
});

const data = await response.json();
console.log(data);`.trim();
  }

  generatePythonExample(endpoint) {
    return `
import requests

response = requests.${endpoint.method.toLowerCase()}(
    '${endpoint.fullUrl}',
    headers={
        'Authorization': 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json'
    }${['POST', 'PUT', 'PATCH'].includes(endpoint.method) ? ',\n    json={"key": "value"}' : ''}
)

data = response.json()
print(data)`.trim();
  }

  generateAuthDocs() {
    return {
      type: 'Bearer Token',
      description: 'All API requests require authentication using a Bearer token',
      tokenEndpoint: 'https://api.kgen.io/auth/login',
      refreshEndpoint: 'https://api.kgen.io/auth/refresh',
      tokenExpiry: 3600,
      scopes: [
        'read:templates',
        'write:templates',
        'read:data',
        'write:data',
        'admin:all'
      ],
      examples: {
        header: 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    };
  }

  generateRateLimitDocs() {
    return {
      default: {
        requests: 1000,
        window: '1 hour',
        headers: {
          'X-RateLimit-Limit': 'Total requests allowed',
          'X-RateLimit-Remaining': 'Requests remaining in window',
          'X-RateLimit-Reset': 'Unix timestamp when window resets'
        }
      },
      tiers: {
        free: { requests: 100, window: '1 hour' },
        pro: { requests: 1000, window: '1 hour' },
        enterprise: { requests: 10000, window: '1 hour' }
      },
      handling: {
        statusCode: 429,
        retryAfter: 'Seconds until rate limit resets',
        backoffStrategy: 'Exponential backoff recommended'
      }
    };
  }

  generateSDKDocs() {
    return [
      {
        language: 'JavaScript',
        name: '@kgen/client-js',
        version: '2.1.0',
        install: 'npm install @kgen/client-js',
        repository: 'https://github.com/kgen/client-js',
        documentation: 'https://docs.kgen.io/sdks/javascript'
      },
      {
        language: 'Python',
        name: 'kgen-python',
        version: '1.5.0',
        install: 'pip install kgen-python',
        repository: 'https://github.com/kgen/python-client',
        documentation: 'https://docs.kgen.io/sdks/python'
      },
      {
        language: 'Go',
        name: 'kgen-go',
        version: '1.2.0',
        install: 'go get github.com/kgen/go-client',
        repository: 'https://github.com/kgen/go-client',
        documentation: 'https://docs.kgen.io/sdks/go'
      },
      {
        language: 'Java',
        name: 'kgen-java',
        version: '2.0.1',
        install: 'implementation "io.kgen:kgen-java:2.0.1"',
        repository: 'https://github.com/kgen/java-client',
        documentation: 'https://docs.kgen.io/sdks/java'
      }
    ];
  }

  generatePlaygroundDocs() {
    return {
      url: 'https://playground.kgen.io',
      features: [
        'Interactive API testing',
        'Real-time code generation',
        'Request/response inspection',
        'Authentication testing',
        'Schema validation'
      ],
      collections: [
        'Authentication Workflows',
        'Data Processing Examples',
        'Template Management',
        'Analytics Queries'
      ]
    };
  }

  generateResourceDocs() {
    return {
      documentation: 'https://docs.kgen.io',
      guides: 'https://docs.kgen.io/guides',
      tutorials: 'https://docs.kgen.io/tutorials',
      changelog: 'https://docs.kgen.io/changelog',
      status: 'https://status.kgen.io',
      support: 'https://support.kgen.io',
      community: 'https://community.kgen.io',
      github: 'https://github.com/kgen'
    };
  }

  getEndpointRateLimit(endpoint) {
    // Different endpoints may have different rate limits
    const limits = {
      '/login': { requests: 10, window: '15 minutes' },
      '/upload': { requests: 50, window: '1 hour' },
      '/datasets': { requests: 100, window: '1 hour' }
    };
    
    return limits[endpoint.path] || { requests: 1000, window: '1 hour' };
  }

  getEndpointAuth(endpoint) {
    // Some endpoints may not require authentication
    const publicEndpoints = ['/health', '/status', '/docs'];
    return !publicEndpoints.includes(endpoint.path);
  }

  loadTemplates() {
    // Load documentation templates for different API types
    this.templates.set('rest', {
      structure: ['overview', 'authentication', 'endpoints', 'errors', 'examples'],
      format: 'openapi'
    });
    
    this.templates.set('graphql', {
      structure: ['schema', 'queries', 'mutations', 'subscriptions', 'examples'],
      format: 'graphql-schema'
    });
  }
}