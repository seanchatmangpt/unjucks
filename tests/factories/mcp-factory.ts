import { faker } from '@faker-js/faker';

export interface MCPRequest {
  method: string;
  params?: Record<string, any>;
  id?: string | number;
  jsonrpc?: string;
}

export interface MCPResponse {
  id: string | number;
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export class MCPFactory {
  /**
   * Create MCP request
   */
  static createRequest(overrides: Partial<MCPRequest> = {}): MCPRequest {
    const methods = [
      'unjucks/list',
      'unjucks/generate',
      'unjucks/help',
      'unjucks/dry-run',
      'unjucks/inject'
    ];

    return {
      method: overrides.method || faker.helpers.arrayElement(methods),
      params: overrides.params || this.createRequestParams(),
      id: overrides.id || faker.string.uuid(),
      jsonrpc: overrides.jsonrpc || '2.0',
      ...overrides
    };
  }

  /**
   * Create MCP response
   */
  static createResponse(overrides: Partial<MCPResponse> = {}): MCPResponse {
    return {
      id: overrides.id || faker.string.uuid(),
      jsonrpc: overrides.jsonrpc || '2.0',
      result: overrides.result || this.createResponseResult(),
      error: overrides.error,
      ...overrides
    };
  }

  /**
   * Create error response
   */
  static createErrorResponse(overrides: Partial<MCPResponse> = {}): MCPResponse {
    return this.createResponse({
      result: undefined,
      error: {
        code: overrides.error?.code || faker.datatype.number({ min: -32999, max: -32000 }),
        message: overrides.error?.message || faker.lorem.sentence(),
        data: overrides.error?.data || { details: faker.lorem.paragraph() }
      },
      ...overrides
    });
  }

  /**
   * Create MCP tool
   */
  static createTool(overrides: Partial<MCPTool> = {}): MCPTool {
    return {
      name: overrides.name || `unjucks_${faker.hacker.noun()}`,
      description: overrides.description || faker.lorem.sentence(),
      inputSchema: overrides.inputSchema || this.createInputSchema(),
      ...overrides
    };
  }

  /**
   * Create MCP resource
   */
  static createResource(overrides: Partial<MCPResource> = {}): MCPResource {
    return {
      uri: overrides.uri || `file://${faker.system.filePath()}`,
      name: overrides.name || faker.system.fileName(),
      description: overrides.description || faker.lorem.sentence(),
      mimeType: overrides.mimeType || faker.helpers.arrayElement([
        'application/json',
        'text/plain',
        'text/javascript',
        'text/typescript'
      ]),
      ...overrides
    };
  }

  /**
   * Create request parameters
   */
  static createRequestParams(method?: string): Record<string, any> {
    const methodParams: Record<string, () => Record<string, any>> = {
      'unjucks/list': () => ({
        templatesDir: faker.system.directoryPath()
      }),

      'unjucks/generate': () => ({
        generator: faker.hacker.noun(),
        template: faker.hacker.noun(),
        dest: faker.system.directoryPath(),
        variables: {
          name: faker.person.firstName(),
          description: faker.lorem.sentence(),
          hasTests: faker.datatype.boolean()
        },
        force: faker.datatype.boolean(),
        dry: faker.datatype.boolean()
      }),

      'unjucks/help': () => ({
        generator: faker.hacker.noun(),
        template: faker.hacker.noun()
      }),

      'unjucks/dry-run': () => ({
        generator: faker.hacker.noun(),
        template: faker.hacker.noun(),
        dest: faker.system.directoryPath(),
        variables: {
          name: faker.person.firstName()
        }
      }),

      'unjucks/inject': () => ({
        file: faker.system.filePath(),
        content: faker.lorem.paragraph(),
        options: {
          before: faker.lorem.word(),
          after: faker.lorem.word(),
          skipIf: faker.lorem.word()
        }
      })
    };

    const selectedMethod = method || faker.helpers.arrayElement(Object.keys(methodParams));
    return methodParams[selectedMethod]?.() || {};
  }

  /**
   * Create response result
   */
  static createResponseResult(method?: string): any {
    const methodResults: Record<string, () => any> = {
      'unjucks/list': () => ({
        generators: Array.from({ length: faker.datatype.number({ min: 1, max: 5 }) }, () => ({
          name: faker.hacker.noun(),
          description: faker.lorem.sentence(),
          templates: Array.from({ length: faker.datatype.number({ min: 1, max: 3 }) }, () => ({
            name: faker.hacker.noun(),
            description: faker.lorem.sentence()
          }))
        }))
      }),

      'unjucks/generate': () => ({
        success: true,
        files: Array.from({ length: faker.datatype.number({ min: 1, max: 5 }) }, () => ({
          path: faker.system.filePath(),
          content: faker.lorem.paragraphs(),
          created: true
        }))
      }),

      'unjucks/help': () => ({
        generator: faker.hacker.noun(),
        template: faker.hacker.noun(),
        description: faker.lorem.paragraph(),
        variables: Array.from({ length: faker.datatype.number({ min: 1, max: 5 }) }, () => ({
          name: faker.hacker.noun(),
          type: faker.helpers.arrayElement(['string', 'boolean', 'number']),
          description: faker.lorem.sentence(),
          required: faker.datatype.boolean()
        }))
      }),

      'unjucks/dry-run': () => ({
        wouldCreate: Array.from({ length: faker.datatype.number({ min: 1, max: 5 }) }, () => ({
          path: faker.system.filePath(),
          size: faker.datatype.number({ min: 100, max: 10000 })
        })),
        wouldModify: Array.from({ length: faker.datatype.number({ min: 0, max: 3 }) }, () => ({
          path: faker.system.filePath(),
          changes: faker.datatype.number({ min: 1, max: 50 })
        }))
      }),

      'unjucks/inject': () => ({
        success: true,
        modified: true,
        linesAdded: faker.datatype.number({ min: 1, max: 10 }),
        originalContent: faker.lorem.paragraphs(),
        modifiedContent: faker.lorem.paragraphs()
      })
    };

    const selectedMethod = method || faker.helpers.arrayElement(Object.keys(methodResults));
    return methodResults[selectedMethod]?.() || { success: true };
  }

  /**
   * Create input schema
   */
  static createInputSchema(): Record<string, any> {
    return {
      type: 'object',
      properties: {
        generator: {
          type: 'string',
          description: 'Name of the generator to use'
        },
        template: {
          type: 'string',
          description: 'Name of the template to generate'
        },
        dest: {
          type: 'string',
          description: 'Destination directory',
          default: './src'
        },
        variables: {
          type: 'object',
          description: 'Variables to pass to the template'
        },
        force: {
          type: 'boolean',
          description: 'Overwrite existing files',
          default: false
        },
        dry: {
          type: 'boolean',
          description: 'Perform dry run without creating files',
          default: false
        }
      },
      required: ['generator', 'template']
    };
  }

  /**
   * Create MCP server capabilities
   */
  static createServerCapabilities() {
    return {
      tools: Array.from({ length: 5 }, () => this.createTool()),
      resources: Array.from({ length: 3 }, () => this.createResource()),
      prompts: [
        {
          name: 'generate_component',
          description: 'Generate a new React component',
          arguments: [
            {
              name: 'componentName',
              description: 'Name of the component',
              required: true
            },
            {
              name: 'hasProps',
              description: 'Whether component should have props interface',
              required: false
            }
          ]
        }
      ]
    };
  }

  /**
   * Create protocol scenarios
   */
  static createProtocolScenarios() {
    return {
      validRequest: this.createRequest({
        method: 'unjucks/generate',
        params: {
          generator: 'component',
          template: 'react',
          dest: './src/components',
          variables: { name: 'Button' }
        }
      }),

      invalidMethod: this.createRequest({
        method: 'unjucks/invalid_method'
      }),

      missingParams: this.createRequest({
        method: 'unjucks/generate',
        params: {}
      }),

      malformedRequest: {
        method: 'unjucks/generate',
        params: {
          generator: null,
          template: undefined,
          variables: 'invalid'
        },
        id: 'test-request',
        jsonrpc: '1.0' // Wrong version
      },

      successResponse: this.createResponse({
        result: {
          success: true,
          files: [
            { path: 'src/Button.tsx', created: true },
            { path: 'src/Button.test.tsx', created: true }
          ]
        }
      }),

      errorResponse: this.createErrorResponse({
        error: {
          code: -32602,
          message: 'Invalid params',
          data: { missing: ['generator', 'template'] }
        }
      })
    };
  }

  /**
   * Create batch request scenarios
   */
  static createBatchScenarios() {
    return {
      multipleMethods: [
        this.createRequest({ method: 'unjucks/list' }),
        this.createRequest({ method: 'unjucks/help', params: { generator: 'component' } }),
        this.createRequest({ 
          method: 'unjucks/generate', 
          params: { 
            generator: 'component', 
            template: 'react', 
            variables: { name: 'Button' } 
          }
        })
      ],

      mixedValidInvalid: [
        this.createRequest({ method: 'unjucks/list' }),
        this.createRequest({ method: 'unjucks/invalid' }),
        this.createRequest({ method: 'unjucks/generate', params: {} })
      ],

      allInvalid: [
        this.createRequest({ method: 'invalid/method1' }),
        this.createRequest({ method: 'invalid/method2' }),
        this.createRequest({ method: 'invalid/method3' })
      ]
    };
  }

  /**
   * Create performance test scenarios
   */
  static createPerformanceScenarios() {
    return {
      largeVariables: this.createRequest({
        method: 'unjucks/generate',
        params: {
          generator: 'component',
          template: 'complex',
          variables: Object.fromEntries(
            Array.from({ length: 100 }, (_, i) => [
              `variable_${i}`,
              faker.lorem.paragraphs(10)
            ])
          )
        }
      }),

      manyRequests: Array.from({ length: 50 }, (_, i) => 
        this.createRequest({
          id: i,
          method: 'unjucks/generate',
          params: {
            generator: 'component',
            template: 'basic',
            variables: { name: `Component${i}` }
          }
        })
      ),

      deepNesting: this.createRequest({
        method: 'unjucks/generate',
        params: {
          generator: 'nested',
          template: 'deep',
          variables: this.createDeepNestedObject(10)
        }
      })
    };
  }

  /**
   * Create deep nested object for testing
   */
  private static createDeepNestedObject(depth: number): any {
    if (depth === 0) {
      return faker.lorem.word();
    }

    return {
      level: depth,
      data: faker.lorem.sentence(),
      nested: this.createDeepNestedObject(depth - 1),
      array: Array.from({ length: 3 }, () => this.createDeepNestedObject(depth - 1))
    };
  }
}

// Convenience exports
export const {
  createRequest,
  createResponse,
  createErrorResponse,
  createTool,
  createResource,
  createRequestParams,
  createResponseResult,
  createInputSchema,
  createServerCapabilities,
  createProtocolScenarios,
  createBatchScenarios,
  createPerformanceScenarios
} = MCPFactory;