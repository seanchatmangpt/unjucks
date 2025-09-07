/**
 * MCP Testing Utilities
 * 
 * Comprehensive utilities for testing MCP integration scenarios including:
 * - Mock MCP server management
 * - Test data factories
 * - Performance measurement
 * - Security validation
 * - Enterprise scenario builders
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { performance } from 'perf_hooks';
import chalk from 'chalk';
import { MCPBridge, SwarmTask, JTBDWorkflow } from '../../src/lib/mcp-integration.js';
import type {
  MCPRequest,
  MCPResponse,
  MCPError,
  ToolResult,
  UnjucksGenerateParams,
  UnjucksInjectParams,
  MCPErrorCode
} from '../../src/mcp/types.js';

/**
 * Mock MCP Server for Testing
 */
export class MockMCPServer extends EventEmitter {
  private isRunning = false;
  private requestHistory: MCPRequest[] = [];
  private responseHistory: MCPResponse[] = [];
  private latency = 50; // Default latency in ms
  private errorRate = 0; // Error rate between 0 and 1

  constructor(private config: {
    latency?: number;
    errorRate?: number;
    debugMode?: boolean;
  } = {}) {
    super();
    this.latency = config.latency ?? 50;
    this.errorRate = config.errorRate ?? 0;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.emit('started');
    
    if (this.config.debugMode) {
      console.log(chalk.green('✓ Mock MCP Server started'));
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.emit('stopped');
    
    if (this.config.debugMode) {
      console.log(chalk.gray('✓ Mock MCP Server stopped'));
    }
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    this.requestHistory.push(request);
    
    // Simulate latency
    await new Promise(resolve => setTimeout(resolve, this.latency));
    
    // Simulate errors
    if (Math.random() < this.errorRate) {
      const errorResponse: MCPResponse = {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCode.InternalError,
          message: 'Simulated server error',
          data: { request: request.method }
        }
      };
      
      this.responseHistory.push(errorResponse);
      return errorResponse;
    }

    // Generate appropriate response based on method
    const response = this.generateResponse(request);
    this.responseHistory.push(response);
    
    return response;
  }

  private generateResponse(request: MCPRequest): MCPResponse {
    switch (request.method) {
      case 'tools/list':
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            tools: [
              {
                name: 'unjucks_list',
                description: 'List available generators and templates',
                inputSchema: {
                  type: 'object',
                  properties: {
                    generator: { type: 'string' },
                    detailed: { type: 'boolean' }
                  }
                }
              },
              {
                name: 'unjucks_generate',
                description: 'Generate files from templates',
                inputSchema: {
                  type: 'object',
                  properties: {
                    generator: { type: 'string' },
                    template: { type: 'string' },
                    dest: { type: 'string' },
                    variables: { type: 'object' }
                  },
                  required: ['generator', 'template', 'dest']
                }
              },
              {
                name: 'unjucks_help',
                description: 'Get help for a specific generator/template',
                inputSchema: {
                  type: 'object',
                  properties: {
                    generator: { type: 'string' },
                    template: { type: 'string' }
                  },
                  required: ['generator', 'template']
                }
              },
              {
                name: 'unjucks_dry_run',
                description: 'Preview generation without creating files',
                inputSchema: {
                  type: 'object',
                  properties: {
                    generator: { type: 'string' },
                    template: { type: 'string' },
                    dest: { type: 'string' },
                    variables: { type: 'object' }
                  },
                  required: ['generator', 'template', 'dest']
                }
              },
              {
                name: 'unjucks_inject',
                description: 'Inject content into existing files',
                inputSchema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string' },
                    content: { type: 'string' },
                    before: { type: 'string' },
                    after: { type: 'string' }
                  },
                  required: ['file', 'content']
                }
              }
            ]
          }
        };

      case 'tools/call':
        return this.handleToolCall(request);

      case 'initialize':
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: true },
              logging: { level: "info" }
            },
            serverInfo: {
              name: "unjucks-mcp-server",
              version: "1.0.0"
            }
          }
        };

      default:
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.MethodNotFound,
            message: `Method not found: ${request.method}`
          }
        };
    }
  }

  private handleToolCall(request: MCPRequest): MCPResponse {
    const { name, arguments: args } = request.params;
    
    switch (name) {
      case 'unjucks_list':
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                generators: [
                  {
                    name: 'component',
                    path: '_templates/component',
                    description: 'React component generator',
                    templates: ['basic', 'typescript', 'with-props']
                  },
                  {
                    name: 'api',
                    path: '_templates/api',
                    description: 'API endpoint generator',
                    templates: ['rest', 'graphql', 'fhir']
                  },
                  {
                    name: 'migration',
                    path: '_templates/migration',
                    description: 'Database migration generator',
                    templates: ['sql', 'nosql']
                  }
                ]
              })
            }]
          }
        };

      case 'unjucks_generate':
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                filesCreated: [
                  `${args.dest}/${args.variables?.name || 'Generated'}.tsx`
                ],
                summary: {
                  created: 1,
                  updated: 0,
                  skipped: 0,
                  injected: 0
                }
              })
            }]
          }
        };

      case 'unjucks_help':
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                generator: args.generator,
                template: args.template,
                description: `Help for ${args.generator}/${args.template}`,
                variables: [
                  { name: 'name', type: 'string', required: true },
                  { name: 'withProps', type: 'boolean', defaultValue: false },
                  { name: 'withTests', type: 'boolean', defaultValue: false }
                ],
                examples: [
                  `unjucks generate ${args.generator} ${args.template} --name MyComponent`,
                  `unjucks generate ${args.generator} ${args.template} --name MyComponent --withProps --withTests`
                ]
              })
            }]
          }
        };

      case 'unjucks_dry_run':
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                preview: [
                  {
                    path: `${args.dest}/${args.variables?.name || 'Preview'}.tsx`,
                    content: `// Preview of ${args.generator}/${args.template}\n// Generated content would appear here`,
                    action: 'create'
                  }
                ],
                summary: {
                  willCreate: 1,
                  willUpdate: 0,
                  willSkip: 0
                }
              })
            }]
          }
        };

      case 'unjucks_inject':
        return {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                file: args.file,
                injected: true,
                position: args.before ? 'before' : args.after ? 'after' : 'append',
                preview: `Content injected into ${args.file}`
              })
            }]
          }
        };

      default:
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCode.MethodNotFound,
            message: `Unknown tool: ${name}`
          }
        };
    }
  }

  getStats() {
    return {
      requestCount: this.requestHistory.length,
      responseCount: this.responseHistory.length,
      errorCount: this.responseHistory.filter(r => r.error).length,
      isRunning: this.isRunning,
      averageLatency: this.latency
    };
  }

  getRequestHistory(): MCPRequest[] {
    return [...this.requestHistory];
  }

  getResponseHistory(): MCPResponse[] {
    return [...this.responseHistory];
  }

  reset(): void {
    this.requestHistory = [];
    this.responseHistory = [];
  }
}

/**
 * Test Data Factories
 */
export class MCPTestDataFactory {
  static createSwarmTask(type: 'generate' | 'scaffold' | 'refactor' | 'document' = 'generate'): SwarmTask {
    const baseId = `test-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    switch (type) {
      case 'generate':
        return {
          id: baseId,
          type: 'generate',
          description: 'Generate React component with TypeScript',
          parameters: {
            generator: 'component',
            template: 'typescript',
            dest: './output',
            variables: {
              name: 'TestComponent',
              withProps: true,
              withTests: true
            }
          },
          priority: 'high'
        };

      case 'scaffold':
        return {
          id: baseId,
          type: 'scaffold',
          description: 'Scaffold new microservice project',
          parameters: {
            name: 'test-service',
            description: 'Test microservice',
            dest: './output',
            variables: {
              database: 'postgresql',
              authentication: 'jwt',
              withOpenAPI: true,
              withMonitoring: true
            }
          },
          priority: 'medium'
        };

      case 'refactor':
        return {
          id: baseId,
          type: 'refactor',
          description: 'Add error handling to existing code',
          parameters: {
            file: './src/components/UserForm.tsx',
            content: 'try {\n  // Original code\n} catch (error) {\n  handleError(error);\n}',
            before: 'export const UserForm',
            force: false
          },
          priority: 'low'
        };

      case 'document':
        return {
          id: baseId,
          type: 'document',
          description: 'Generate API documentation',
          parameters: {
            docType: 'openapi',
            title: 'Test API Documentation',
            dest: './docs',
            variables: {
              version: '1.0.0',
              baseUrl: 'https://api.example.com'
            }
          },
          priority: 'medium'
        };

      default:
        throw new Error(`Unknown task type: ${type}`);
    }
  }

  static createJTBDWorkflow(complexity: 'simple' | 'complex' | 'enterprise' = 'simple'): JTBDWorkflow {
    const baseId = `jtbd-${complexity}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    switch (complexity) {
      case 'simple':
        return {
          id: baseId,
          name: 'Simple Component Generation',
          description: 'Generate a basic React component',
          job: 'Create a reusable UI component',
          steps: [
            {
              action: 'generate',
              description: 'Generate component file',
              generator: 'component',
              template: 'basic',
              parameters: {
                dest: './output',
                variables: { name: 'SimpleComponent' }
              }
            },
            {
              action: 'validate',
              description: 'Validate generated file',
              parameters: {
                files: ['./output/SimpleComponent.tsx']
              }
            }
          ]
        };

      case 'complex':
        return {
          id: baseId,
          name: 'Full-Stack Feature Development',
          description: 'Generate complete feature with API, UI, and tests',
          job: 'Deliver a complete user-facing feature',
          steps: [
            {
              action: 'generate',
              description: 'Generate API endpoints',
              generator: 'api',
              template: 'rest',
              parameters: {
                dest: './output/api',
                variables: {
                  entityName: 'User',
                  operations: ['create', 'read', 'update', 'delete']
                }
              }
            },
            {
              action: 'generate',
              description: 'Generate database migrations',
              generator: 'migration',
              template: 'sql',
              parameters: {
                dest: './output/migrations',
                variables: {
                  tableName: 'users',
                  columns: ['id', 'email', 'name', 'created_at', 'updated_at']
                }
              }
            },
            {
              action: 'generate',
              description: 'Generate React components',
              generator: 'component',
              template: 'typescript',
              parameters: {
                dest: './output/components',
                variables: {
                  name: 'UserManager',
                  withProps: true,
                  withTests: true
                }
              }
            },
            {
              action: 'generate',
              description: 'Generate test files',
              generator: 'test',
              template: 'integration',
              parameters: {
                dest: './output/tests',
                variables: {
                  feature: 'user-management',
                  endpoints: ['POST /users', 'GET /users', 'PUT /users/:id', 'DELETE /users/:id']
                }
              }
            },
            {
              action: 'validate',
              description: 'Validate all generated files',
              parameters: {
                files: [
                  './output/api/UserController.ts',
                  './output/migrations/001_create_users_table.sql',
                  './output/components/UserManager.tsx',
                  './output/tests/user-management.integration.test.ts'
                ]
              }
            }
          ]
        };

      case 'enterprise':
        return {
          id: baseId,
          name: 'Enterprise Microservice Deployment',
          description: 'Generate complete enterprise-grade microservice',
          job: 'Deploy production-ready microservice with full compliance',
          steps: [
            {
              action: 'generate',
              description: 'Generate service architecture',
              generator: 'architecture',
              template: 'microservice',
              parameters: {
                dest: './output/architecture',
                variables: {
                  serviceName: 'PaymentService',
                  compliance: ['SOX', 'PCI-DSS'],
                  scalability: 'high',
                  availability: '99.99%'
                }
              }
            },
            {
              action: 'generate',
              description: 'Generate API with OpenAPI spec',
              generator: 'api',
              template: 'enterprise',
              parameters: {
                dest: './output/api',
                variables: {
                  serviceName: 'PaymentService',
                  version: '1.0.0',
                  authentication: 'OAuth2+JWT',
                  rateLimit: '1000/hour',
                  monitoring: true
                }
              }
            },
            {
              action: 'generate',
              description: 'Generate database schemas with audit',
              generator: 'database',
              template: 'enterprise-postgres',
              parameters: {
                dest: './output/database',
                variables: {
                  schemas: ['payments', 'audit', 'monitoring'],
                  encryption: 'column-level',
                  backup: 'point-in-time',
                  replication: 'master-slave'
                }
              }
            },
            {
              action: 'generate',
              description: 'Generate security configuration',
              generator: 'security',
              template: 'enterprise',
              parameters: {
                dest: './output/security',
                variables: {
                  authentication: 'OAuth2+JWT',
                  authorization: 'RBAC',
                  encryption: 'AES-256',
                  secretsManagement: 'HashiCorp Vault',
                  networkSecurity: 'VPC with private subnets'
                }
              }
            },
            {
              action: 'generate',
              description: 'Generate monitoring and observability',
              generator: 'monitoring',
              template: 'enterprise',
              parameters: {
                dest: './output/monitoring',
                variables: {
                  metrics: ['Prometheus', 'Grafana'],
                  logging: ['ELK Stack'],
                  tracing: ['Jaeger'],
                  alerting: ['PagerDuty'],
                  dashboards: ['business', 'technical', 'security']
                }
              }
            },
            {
              action: 'generate',
              description: 'Generate CI/CD pipelines',
              generator: 'cicd',
              template: 'enterprise',
              parameters: {
                dest: './output/cicd',
                variables: {
                  platform: 'GitHub Actions',
                  environments: ['dev', 'staging', 'prod'],
                  testing: ['unit', 'integration', 'contract', 'e2e', 'security'],
                  deployment: 'blue-green',
                  infrastructure: 'Terraform',
                  containerization: 'Docker + Kubernetes'
                }
              }
            },
            {
              action: 'generate',
              description: 'Generate compliance documentation',
              generator: 'compliance',
              template: 'sox-pci',
              parameters: {
                dest: './output/compliance',
                variables: {
                  standards: ['SOX', 'PCI-DSS'],
                  auditTrail: true,
                  dataClassification: 'confidential',
                  retentionPolicy: '7 years',
                  accessControls: 'principle of least privilege'
                }
              }
            },
            {
              action: 'validate',
              description: 'Validate enterprise compliance',
              parameters: {
                compliance: ['SOX', 'PCI-DSS'],
                security: true,
                performance: true,
                scalability: true,
                monitoring: true
              }
            }
          ]
        };

      default:
        throw new Error(`Unknown complexity level: ${complexity}`);
    }
  }

  static createMCPRequest(method: string, params?: any): MCPRequest {
    return {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params
    };
  }

  static createEnterpriseContext(domain: string = 'financial-services') {
    const contexts = {
      'financial-services': {
        compliance: ['SOX', 'PCI-DSS', 'GDPR', 'CCPA'],
        regulations: ['Basel III', 'Dodd-Frank', 'MiFID II'],
        security: {
          dataClassification: ['public', 'internal', 'confidential', 'restricted'],
          encryption: 'AES-256-GCM',
          keyManagement: 'Hardware Security Modules (HSM)',
          authentication: 'Multi-factor with biometrics',
          authorization: 'Attribute-based access control (ABAC)'
        },
        performance: {
          latency: '< 50ms',
          throughput: '> 10,000 TPS',
          availability: '99.99%',
          recovery: 'RTO < 15min, RPO < 5min'
        },
        monitoring: {
          metrics: ['business KPIs', 'technical metrics', 'security events'],
          alerting: ['real-time', 'predictive', 'escalation'],
          dashboards: ['executive', 'operational', 'technical']
        }
      },
      'healthcare': {
        compliance: ['HIPAA', 'HITECH', 'GDPR', 'FDA'],
        standards: ['FHIR R4', 'HL7', 'DICOM', 'ICD-10'],
        security: {
          dataClassification: ['PHI', 'PII', 'public'],
          encryption: 'FIPS 140-2 Level 3',
          authentication: 'Strong authentication with audit',
          authorization: 'Role-based with minimum necessary principle'
        },
        interoperability: {
          standards: ['FHIR', 'HL7 v2', 'CDA'],
          apis: ['RESTful FHIR', 'GraphQL'],
          messaging: ['secure', 'audit-logged', 'encrypted']
        }
      },
      'e-commerce': {
        compliance: ['PCI-DSS', 'GDPR', 'CCPA', 'COPPA'],
        performance: {
          latency: '< 100ms',
          availability: '99.9%',
          scalability: 'elastic auto-scaling'
        },
        security: {
          paymentSecurity: 'PCI-DSS Level 1',
          dataProtection: 'encryption at rest and in transit',
          fraudDetection: 'ML-based real-time analysis'
        }
      }
    };

    return contexts[domain as keyof typeof contexts] || contexts['financial-services'];
  }
}

/**
 * Performance Measurement Utilities
 */
export class MCPPerformanceProfiler {
  private measurements: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();

  startMeasurement(operation: string): void {
    this.startTimes.set(operation, performance.now());
  }

  endMeasurement(operation: string): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      throw new Error(`No start time found for operation: ${operation}`);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, []);
    }
    this.measurements.get(operation)!.push(duration);

    this.startTimes.delete(operation);
    return duration;
  }

  getStatistics(operation: string) {
    const measurements = this.measurements.get(operation);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);
    
    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      mean: sum / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(
        measurements.reduce((acc, val) => acc + Math.pow(val - (sum / measurements.length), 2), 0) / 
        measurements.length
      )
    };
  }

  getAllStatistics() {
    const results: Record<string, any> = {};
    for (const operation of this.measurements.keys()) {
      results[operation] = this.getStatistics(operation);
    }
    return results;
  }

  reset(): void {
    this.measurements.clear();
    this.startTimes.clear();
  }
}

/**
 * Test Environment Management
 */
export class MCPTestEnvironment {
  constructor(
    public readonly tempDir: string,
    public readonly templatesDir: string,
    public readonly outputDir: string
  ) {}

  static async create(baseDir?: string): Promise<MCPTestEnvironment> {
    const testBaseDir = baseDir || process.cwd();
    const tempDir = join(testBaseDir, 'tests', '.tmp', `mcp-env-${Date.now()}`);
    const templatesDir = join(tempDir, '_templates');
    const outputDir = join(tempDir, 'output');

    // Create directories
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    const env = new MCPTestEnvironment(tempDir, templatesDir, outputDir);
    await env.setupTemplates();
    
    return env;
  }

  private async setupTemplates(): Promise<void> {
    // Create comprehensive test templates
    const templateConfigs = [
      {
        generator: 'component',
        template: 'typescript',
        files: ['component.njk', 'test.njk', 'story.njk']
      },
      {
        generator: 'api',
        template: 'rest',
        files: ['controller.njk', 'routes.njk', 'middleware.njk']
      },
      {
        generator: 'database',
        template: 'migration',
        files: ['create_table.njk', 'add_column.njk', 'create_index.njk']
      }
    ];

    for (const config of templateConfigs) {
      const templateDir = join(this.templatesDir, config.generator, config.template);
      await fs.mkdir(templateDir, { recursive: true });

      for (const fileName of config.files) {
        await this.createTemplateFile(templateDir, fileName, config.generator, config.template);
      }
    }
  }

  private async createTemplateFile(dir: string, fileName: string, generator: string, template: string): Promise<void> {
    const content = this.generateTemplateContent(fileName, generator, template);
    await fs.writeFile(join(dir, fileName), content);
  }

  private generateTemplateContent(fileName: string, generator: string, template: string): string {
    const templates = {
      'component.njk': `---
to: "{{ dest }}/{{ name | pascalCase }}.tsx"
---
import React from 'react';

interface {{ name | pascalCase }}Props {
  className?: string;
  children?: React.ReactNode;
}

export const {{ name | pascalCase }}: React.FC<{{ name | pascalCase }}Props> = ({
  className,
  children
}) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
};

export default {{ name | pascalCase }};`,

      'test.njk': `---
to: "{{ dest }}/__tests__/{{ name | pascalCase }}.test.tsx"
---
import React from 'react';
import { render, screen } from '@testing-library/react';
import { {{ name | pascalCase }} } from '../{{ name | pascalCase }}';

describe('{{ name | pascalCase }}', () => {
  it('renders without crashing', () => {
    render(<{{ name | pascalCase }} />);
  });

  it('renders children correctly', () => {
    render(<{{ name | pascalCase }}>Test Content</{{ name | pascalCase }}>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});`,

      'controller.njk': `---
to: "{{ dest }}/{{ name | pascalCase }}Controller.ts"
---
import { Request, Response } from 'express';
import { {{ name | pascalCase }}Service } from '../services/{{ name | pascalCase }}Service';

export class {{ name | pascalCase }}Controller {
  constructor(private {{ name | camelCase }}Service: {{ name | pascalCase }}Service) {}

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.{{ name | camelCase }}Service.create(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const results = await this.{{ name | camelCase }}Service.findAll(req.query);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async findById(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.{{ name | camelCase }}Service.findById(req.params.id);
      if (!result) {
        return res.status(404).json({ error: '{{ name | pascalCase }} not found' });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}`,

      'create_table.njk': `---
to: "{{ dest }}/{{ timestamp }}_create_{{ tableName }}_table.sql"
---
-- Create {{ tableName }} table
CREATE TABLE {{ tableName }} (
  id BIGSERIAL PRIMARY KEY,
  {% for column in columns -%}
  {{ column.name }} {{ column.type }}{% if column.nullable === false %} NOT NULL{% endif %}{% if column.default %} DEFAULT {{ column.default }}{% endif %},
  {% endfor -%}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
{% for index in indexes -%}
CREATE INDEX idx_{{ tableName }}_{{ index.columns | join('_') }} ON {{ tableName }}({{ index.columns | join(', ') }});
{% endfor %}

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_{{ tableName }}_updated_at 
  BEFORE UPDATE ON {{ tableName }} 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    };

    return templates[fileName as keyof typeof templates] || `---
to: "{{ dest }}/{{ name }}.txt"
---
Generated ${generator}/${template} template: ${fileName}`;
  }

  async cleanup(): Promise<void> {
    try {
      await fs.rmdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.warn(chalk.yellow(`Cleanup warning: ${error}`));
    }
  }

  async createTestFile(relativePath: string, content: string): Promise<string> {
    const fullPath = join(this.tempDir, relativePath);
    const dir = resolve(fullPath, '..');
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content);
    
    return fullPath;
  }

  async fileExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(join(this.tempDir, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async readFile(relativePath: string): Promise<string> {
    return await fs.readFile(join(this.tempDir, relativePath), 'utf-8');
  }
}

/**
 * Security Testing Utilities
 */
export class MCPSecurityTester {
  static createMaliciousRequests(): MCPRequest[] {
    return [
      // Path traversal attempts
      {
        jsonrpc: "2.0",
        id: "path-traversal-1",
        method: "tools/call",
        params: {
          name: "unjucks_generate",
          arguments: {
            generator: "../../../etc/passwd",
            template: "malicious",
            dest: "/etc/"
          }
        }
      },
      
      // Command injection attempts
      {
        jsonrpc: "2.0",
        id: "cmd-injection-1",
        method: "tools/call",
        params: {
          name: "unjucks_inject",
          arguments: {
            file: "test.js; rm -rf /; echo 'pwned'",
            content: "malicious code"
          }
        }
      },

      // Large payload DoS attempt
      {
        jsonrpc: "2.0",
        id: "dos-1",
        method: "tools/call",
        params: {
          name: "unjucks_generate",
          arguments: {
            generator: "test",
            template: "test",
            dest: "./output",
            variables: {
              maliciousData: "x".repeat(1000000) // 1MB string
            }
          }
        }
      },

      // Invalid JSON-RPC format
      {
        jsonrpc: "1.0", // Wrong version
        id: "invalid-rpc-1",
        method: "tools/call"
      } as any
    ];
  }

  static validateSecurityResponse(response: MCPResponse, expectedBlocked: boolean = true): boolean {
    if (expectedBlocked) {
      return !!response.error && response.error.code > 0;
    } else {
      return !response.error;
    }
  }
}

export { MCPTestDataFactory, MCPPerformanceProfiler, MCPTestEnvironment, MCPSecurityTester };