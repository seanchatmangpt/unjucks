import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { MCPFactory, GeneratorFactory } from '../factories/index.js';

// Contract Testing for Microservices Communication
// These tests validate API contracts between services

describe('Microservices Contract Tests', () => {
  let mockMCPServer: any;
  let templateService: any;
  let generatorService: any;

  beforeAll(() => {
    // Setup mock services
    mockMCPServer = createMockMCPServer();
    templateService = createMockTemplateService();
    generatorService = createMockGeneratorService();
  });

  afterAll(() => {
    // Cleanup mock services
    mockMCPServer.close();
  });

  describe('MCP Protocol Contracts', () => {
    it('should conform to JSON-RPC 2.0 specification', async () => {
      const validRequest = MCPFactory.createRequest({
        method: 'unjucks/list',
        params: {},
        id: 'test-001',
        jsonrpc: '2.0'
      });

      const response = await mockMCPServer.handleRequest(validRequest);

      // Response should conform to JSON-RPC 2.0
      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', 'test-001');
      expect(response).toHaveProperty('result');
      expect(response).not.toHaveProperty('error');

      // Result should have expected structure
      expect(response.result).toHaveProperty('content');
      expect(Array.isArray(response.result.content)).toBe(true);
    });

    it('should handle invalid requests with proper error responses', async () => {
      const invalidRequests = [
        { method: 'invalid/method', params: {}, id: 1, jsonrpc: '2.0' },
        { method: 'unjucks/generate', params: null, id: 2, jsonrpc: '2.0' }, // null params
        { method: 'unjucks/generate', id: 3, jsonrpc: '2.0' }, // missing params
        { method: 'unjucks/generate', params: {}, jsonrpc: '1.0' }, // wrong version
      ];

      for (const invalidRequest of invalidRequests) {
        const response = await mockMCPServer.handleRequest(invalidRequest);

        expect(response).toHaveProperty('jsonrpc', '2.0');
        expect(response).toHaveProperty('id', invalidRequest.id);
        expect(response).toHaveProperty('error');
        expect(response.error).toHaveProperty('code');
        expect(response.error).toHaveProperty('message');

        // Error codes should conform to JSON-RPC specification
        expect([-32700, -32600, -32601, -32602, -32603]).toContain(response.error.code);
      }
    });

    it('should support batch requests', async () => {
      const batchRequests = [
        MCPFactory.createRequest({ method: 'unjucks/list', id: 1 }),
        MCPFactory.createRequest({ method: 'unjucks/help', params: { generator: 'component' }, id: 2 }),
        MCPFactory.createRequest({ method: 'unjucks/generate', params: { generator: 'service', template: 'crud' }, id: 3 })
      ];

      const responses = await mockMCPServer.handleBatchRequest(batchRequests);

      expect(Array.isArray(responses)).toBe(true);
      expect(responses).toHaveLength(3);

      responses.forEach((response, index) => {
        expect(response).toHaveProperty('jsonrpc', '2.0');
        expect(response).toHaveProperty('id', index + 1);
        expect(response).toHaveProperty('result');
      });
    });

    it('should handle notifications (requests without id)', async () => {
      const notification = MCPFactory.createRequest({
        method: 'unjucks/list',
        params: {},
        id: undefined // Notification has no ID
      });

      const response = await mockMCPServer.handleRequest(notification);

      // Notifications should not return a response
      expect(response).toBeUndefined();
    });

    it('should validate tool schemas', async () => {
      const tools = await mockMCPServer.listTools();

      expect(tools).toHaveProperty('tools');
      expect(Array.isArray(tools.tools)).toBe(true);

      tools.tools.forEach((tool: any) => {
        // Each tool should have required fields
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');

        // Input schema should be valid JSON Schema
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');

        if (tool.inputSchema.required) {
          expect(Array.isArray(tool.inputSchema.required)).toBe(true);
        }
      });
    });

    it('should handle resource operations', async () => {
      const resources = await mockMCPServer.listResources();

      expect(resources).toHaveProperty('resources');
      expect(Array.isArray(resources.resources)).toBe(true);

      // Each resource should conform to expected structure
      resources.resources.forEach((resource: any) => {
        expect(resource).toHaveProperty('uri');
        expect(resource).toHaveProperty('name');
        expect(resource.uri).toMatch(/^[a-zA-Z][a-zA-Z0-9+.-]*:/); // Valid URI scheme
      });

      // Test resource reading
      if (resources.resources.length > 0) {
        const resource = resources.resources[0];
        const resourceContent = await mockMCPServer.readResource(resource.uri);

        expect(resourceContent).toHaveProperty('contents');
        expect(Array.isArray(resourceContent.contents)).toBe(true);
      }
    });
  });

  describe('Template Service Contracts', () => {
    it('should provide standardized template listing interface', async () => {
      const templatesResponse = await templateService.listTemplates();

      // Response structure contract
      expect(templatesResponse).toHaveProperty('generators');
      expect(Array.isArray(templatesResponse.generators)).toBe(true);

      templatesResponse.generators.forEach((generator: any) => {
        expect(generator).toHaveProperty('name');
        expect(generator).toHaveProperty('templates');
        expect(Array.isArray(generator.templates)).toBe(true);

        generator.templates.forEach((template: any) => {
          expect(template).toHaveProperty('name');
          expect(template).toHaveProperty('variables');
          expect(Array.isArray(template.variables)).toBe(true);
        });
      });
    });

    it('should validate template metadata format', async () => {
      const templateMetadata = await templateService.getTemplateMetadata('component', 'basic');

      // Metadata contract
      expect(templateMetadata).toHaveProperty('generator');
      expect(templateMetadata).toHaveProperty('template');
      expect(templateMetadata).toHaveProperty('variables');
      expect(templateMetadata).toHaveProperty('description');
      expect(templateMetadata).toHaveProperty('files');

      // Variables should be properly typed
      templateMetadata.variables.forEach((variable: any) => {
        expect(variable).toHaveProperty('name');
        expect(variable).toHaveProperty('type');
        expect(['string', 'boolean', 'number', 'array', 'object']).toContain(variable.type);
        expect(variable).toHaveProperty('required');
        expect(typeof variable.required).toBe('boolean');
      });
    });

    it('should handle template validation requests', async () => {
      const validationRequest = {
        generator: 'component',
        template: 'react',
        variables: {
          name: 'TestComponent',
          hasProps: true,
          testFramework: 'vitest'
        }
      };

      const validationResponse = await templateService.validateTemplate(validationRequest);

      expect(validationResponse).toHaveProperty('valid');
      expect(typeof validationResponse.valid).toBe('boolean');
      expect(validationResponse).toHaveProperty('errors');
      expect(Array.isArray(validationResponse.errors)).toBe(true);

      if (!validationResponse.valid) {
        validationResponse.errors.forEach((error: any) => {
          expect(error).toHaveProperty('field');
          expect(error).toHaveProperty('message');
          expect(error).toHaveProperty('code');
        });
      }
    });

    it('should provide template preview functionality', async () => {
      const previewRequest = {
        generator: 'service',
        template: 'crud',
        variables: {
          name: 'UserService',
          database: 'postgresql'
        }
      };

      const previewResponse = await templateService.previewTemplate(previewRequest);

      expect(previewResponse).toHaveProperty('files');
      expect(Array.isArray(previewResponse.files)).toBe(true);

      previewResponse.files.forEach((file: any) => {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('content');
        expect(file).toHaveProperty('size');
        expect(typeof file.size).toBe('number');
      });
    });
  });

  describe('Generator Service Contracts', () => {
    it('should accept standardized generation requests', async () => {
      const generationRequest = GeneratorFactory.createGenerateOptions({
        generator: 'component',
        template: 'react',
        dest: './src/components',
        variables: {
          name: 'UserProfile',
          hasProps: true,
          hasTests: true
        },
        force: false,
        dry: false
      });

      const response = await generatorService.generate(generationRequest);

      // Response contract
      expect(response).toHaveProperty('success');
      expect(typeof response.success).toBe('boolean');
      expect(response).toHaveProperty('files');
      expect(Array.isArray(response.files)).toBe(true);
      expect(response).toHaveProperty('duration');
      expect(typeof response.duration).toBe('number');

      if (response.success) {
        response.files.forEach((file: any) => {
          expect(file).toHaveProperty('path');
          expect(file).toHaveProperty('created');
          expect(file).toHaveProperty('size');
          expect(typeof file.created).toBe('boolean');
          expect(typeof file.size).toBe('number');
        });
      } else {
        expect(response).toHaveProperty('error');
        expect(response.error).toHaveProperty('message');
        expect(response.error).toHaveProperty('code');
      }
    });

    it('should support dry-run requests', async () => {
      const dryRunRequest = GeneratorFactory.createGenerateOptions({
        generator: 'feature',
        template: 'full-stack',
        dry: true,
        variables: {
          name: 'UserManagement'
        }
      });

      const response = await generatorService.generate(dryRunRequest);

      expect(response).toHaveProperty('dry');
      expect(response.dry).toBe(true);
      expect(response).toHaveProperty('wouldCreate');
      expect(Array.isArray(response.wouldCreate)).toBe(true);

      response.wouldCreate.forEach((file: any) => {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('size');
        expect(file).not.toHaveProperty('content'); // No content in dry run
      });
    });

    it('should handle file injection contracts', async () => {
      const injectionRequest = {
        targetFile: './src/index.ts',
        content: 'export { UserService } from "./services/UserService";',
        options: {
          after: 'export { ComponentService }',
          skipIf: 'UserService'
        }
      };

      const response = await generatorService.injectContent(injectionRequest);

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('modified');
      expect(response).toHaveProperty('skipped');
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.modified).toBe('boolean');
      expect(typeof response.skipped).toBe('boolean');

      if (response.success && response.modified) {
        expect(response).toHaveProperty('linesAdded');
        expect(typeof response.linesAdded).toBe('number');
      }

      if (response.skipped) {
        expect(response).toHaveProperty('reason');
        expect(typeof response.reason).toBe('string');
      }
    });

    it('should provide status and progress tracking', async () => {
      const longRunningRequest = GeneratorFactory.createGenerateOptions({
        generator: 'project',
        template: 'monorepo',
        variables: {
          projectName: 'my-workspace',
          packages: ['core', 'ui', 'utils', 'docs']
        }
      });

      // Start generation
      const jobId = await generatorService.startGeneration(longRunningRequest);
      expect(typeof jobId).toBe('string');

      // Check status
      const status = await generatorService.getGenerationStatus(jobId);
      
      expect(status).toHaveProperty('id', jobId);
      expect(status).toHaveProperty('status');
      expect(['pending', 'running', 'completed', 'failed']).toContain(status.status);
      expect(status).toHaveProperty('progress');
      expect(typeof status.progress).toBe('number');
      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(100);

      if (status.status === 'running') {
        expect(status).toHaveProperty('currentStep');
        expect(typeof status.currentStep).toBe('string');
      }

      if (status.status === 'completed') {
        expect(status).toHaveProperty('result');
        expect(status.result).toHaveProperty('files');
      }

      if (status.status === 'failed') {
        expect(status).toHaveProperty('error');
        expect(status.error).toHaveProperty('message');
      }
    });
  });

  describe('File System Service Contracts', () => {
    it('should provide standardized file operations interface', async () => {
      const fileSystemService = createMockFileSystemService();

      // File reading contract
      const readResponse = await fileSystemService.readFile('./src/component.ts');
      expect(readResponse).toHaveProperty('content');
      expect(readResponse).toHaveProperty('encoding');
      expect(readResponse).toHaveProperty('size');
      expect(readResponse).toHaveProperty('lastModified');

      // File writing contract
      const writeRequest = {
        path: './src/newComponent.ts',
        content: 'export const NewComponent = () => {};',
        encoding: 'utf8',
        createDirectories: true
      };

      const writeResponse = await fileSystemService.writeFile(writeRequest);
      expect(writeResponse).toHaveProperty('success');
      expect(writeResponse).toHaveProperty('path');
      expect(writeResponse).toHaveProperty('size');
    });

    it('should handle directory operations', async () => {
      const fileSystemService = createMockFileSystemService();

      // Directory listing contract
      const listResponse = await fileSystemService.listDirectory('./src');
      expect(listResponse).toHaveProperty('files');
      expect(listResponse).toHaveProperty('directories');
      expect(Array.isArray(listResponse.files)).toBe(true);
      expect(Array.isArray(listResponse.directories)).toBe(true);

      listResponse.files.forEach((file: any) => {
        expect(file).toHaveProperty('name');
        expect(file).toHaveProperty('size');
        expect(file).toHaveProperty('lastModified');
      });

      // Directory creation contract
      const createDirResponse = await fileSystemService.createDirectory('./src/new-feature');
      expect(createDirResponse).toHaveProperty('success');
      expect(createDirResponse).toHaveProperty('path');
    });

    it('should validate file permissions', async () => {
      const fileSystemService = createMockFileSystemService();

      const permissionsCheck = await fileSystemService.checkPermissions('./src/protected.ts');
      
      expect(permissionsCheck).toHaveProperty('readable');
      expect(permissionsCheck).toHaveProperty('writable');
      expect(permissionsCheck).toHaveProperty('executable');
      expect(typeof permissionsCheck.readable).toBe('boolean');
      expect(typeof permissionsCheck.writable).toBe('boolean');
      expect(typeof permissionsCheck.executable).toBe('boolean');
    });
  });

  describe('Event System Contracts', () => {
    it('should emit standardized events during operations', async () => {
      const eventService = createMockEventService();
      const receivedEvents: any[] = [];

      // Subscribe to events
      eventService.on('generation.started', (event: any) => {
        receivedEvents.push({ type: 'generation.started', ...event });
      });

      eventService.on('generation.progress', (event: any) => {
        receivedEvents.push({ type: 'generation.progress', ...event });
      });

      eventService.on('generation.completed', (event: any) => {
        receivedEvents.push({ type: 'generation.completed', ...event });
      });

      // Trigger generation
      const request = GeneratorFactory.createGenerateOptions();
      await generatorService.generateWithEvents(request, eventService);

      // Validate events
      expect(receivedEvents.length).toBeGreaterThan(0);

      const startEvent = receivedEvents.find(e => e.type === 'generation.started');
      expect(startEvent).toBeDefined();
      expect(startEvent).toHaveProperty('timestamp');
      expect(startEvent).toHaveProperty('generator');
      expect(startEvent).toHaveProperty('template');

      const progressEvents = receivedEvents.filter(e => e.type === 'generation.progress');
      progressEvents.forEach(event => {
        expect(event).toHaveProperty('progress');
        expect(event).toHaveProperty('currentStep');
        expect(typeof event.progress).toBe('number');
      });

      const completedEvent = receivedEvents.find(e => e.type === 'generation.completed');
      if (completedEvent) {
        expect(completedEvent).toHaveProperty('duration');
        expect(completedEvent).toHaveProperty('filesCreated');
        expect(typeof completedEvent.duration).toBe('number');
        expect(typeof completedEvent.filesCreated).toBe('number');
      }
    });

    it('should handle error events', async () => {
      const eventService = createMockEventService();
      const errorEvents: any[] = [];

      eventService.on('generation.error', (event: any) => {
        errorEvents.push(event);
      });

      // Trigger error scenario
      const invalidRequest = GeneratorFactory.createGenerateOptions({
        generator: 'nonexistent',
        template: 'invalid'
      });

      try {
        await generatorService.generateWithEvents(invalidRequest, eventService);
      } catch (error) {
        // Expected to fail
      }

      expect(errorEvents.length).toBeGreaterThan(0);
      const errorEvent = errorEvents[0];

      expect(errorEvent).toHaveProperty('error');
      expect(errorEvent).toHaveProperty('timestamp');
      expect(errorEvent).toHaveProperty('context');
      expect(errorEvent.error).toHaveProperty('message');
      expect(errorEvent.error).toHaveProperty('code');
    });
  });

  describe('Cross-Service Integration Contracts', () => {
    it('should coordinate between template and generator services', async () => {
      // Template service provides metadata
      const templateMeta = await templateService.getTemplateMetadata('api', 'rest');
      
      // Generator service uses metadata for generation
      const generationRequest = GeneratorFactory.createGenerateOptions({
        generator: 'api',
        template: 'rest',
        variables: templateMeta.variables.reduce((vars: any, v: any) => {
          vars[v.name] = v.defaultValue || getDefaultForType(v.type);
          return vars;
        }, {})
      });

      const result = await generatorService.generate(generationRequest);
      
      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('should handle service dependencies and fallbacks', async () => {
      const orchestrationService = createMockOrchestrationService();

      // Simulate service failure
      templateService.simulateFailure();

      const request = GeneratorFactory.createGenerateOptions();
      const response = await orchestrationService.generateWithFallback(request);

      // Should handle failure gracefully
      if (response.success) {
        expect(response).toHaveProperty('fallbackUsed', true);
        expect(response).toHaveProperty('primaryServiceError');
      } else {
        expect(response).toHaveProperty('error');
        expect(response.error).toHaveProperty('message');
      }

      // Restore service
      templateService.restoreService();
      
      const retryResponse = await orchestrationService.generateWithFallback(request);
      expect(retryResponse.success).toBe(true);
      expect(retryResponse.fallbackUsed).toBe(false);
    });

    it('should maintain transaction consistency across services', async () => {
      const transactionService = createMockTransactionService();

      const complexOperation = {
        steps: [
          { service: 'template', operation: 'validate', params: { generator: 'feature', template: 'crud' } },
          { service: 'generator', operation: 'generate', params: { name: 'UserManager' } },
          { service: 'filesystem', operation: 'writeFiles', params: { dest: './src' } },
          { service: 'git', operation: 'commit', params: { message: 'Add UserManager feature' } }
        ]
      };

      const transactionId = await transactionService.beginTransaction();
      let rollbackRequired = false;

      try {
        for (const step of complexOperation.steps) {
          const result = await transactionService.executeStep(transactionId, step);
          if (!result.success) {
            rollbackRequired = true;
            break;
          }
        }

        if (rollbackRequired) {
          await transactionService.rollback(transactionId);
        } else {
          await transactionService.commit(transactionId);
        }
      } catch (error) {
        await transactionService.rollback(transactionId);
        throw error;
      }

      const transactionStatus = await transactionService.getTransactionStatus(transactionId);
      expect(['committed', 'rolledback']).toContain(transactionStatus.status);
    });
  });

  // Helper functions for creating mock services
  function createMockMCPServer() {
    return {
      async handleRequest(request: any) {
        if (request.method === 'unjucks/list') {
          return MCPFactory.createResponse({
            id: request.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify({ generators: [] })
              }]
            }
          });
        }
        
        if (!request.method || !request.method.startsWith('unjucks/')) {
          return MCPFactory.createErrorResponse({
            id: request.id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          });
        }

        return MCPFactory.createResponse({ id: request.id });
      },

      async handleBatchRequest(requests: any[]) {
        return Promise.all(requests.map(req => this.handleRequest(req)));
      },

      async listTools() {
        return {
          tools: [
            { name: 'unjucks_list', description: 'List generators', inputSchema: { type: 'object', properties: {} } },
            { name: 'unjucks_generate', description: 'Generate files', inputSchema: { type: 'object', properties: { generator: { type: 'string' }, template: { type: 'string' } }, required: ['generator', 'template'] } }
          ]
        };
      },

      async listResources() {
        return {
          resources: [
            { uri: 'file://templates/component/basic.njk', name: 'Basic Component Template' }
          ]
        };
      },

      async readResource(uri: string) {
        return {
          contents: [{
            type: 'text',
            text: 'Template content'
          }]
        };
      },

      close() {
        // Cleanup
      }
    };
  }

  function createMockTemplateService() {
    let serviceFailure = false;

    return {
      async listTemplates() {
        if (serviceFailure) throw new Error('Service unavailable');
        return {
          generators: [{
            name: 'component',
            templates: [{
              name: 'basic',
              variables: [
                { name: 'name', type: 'string', required: true },
                { name: 'hasProps', type: 'boolean', required: false, defaultValue: false }
              ]
            }]
          }]
        };
      },

      async getTemplateMetadata(generator: string, template: string) {
        return {
          generator,
          template,
          description: 'Test template',
          variables: [
            { name: 'name', type: 'string', required: true },
            { name: 'hasProps', type: 'boolean', required: false, defaultValue: false }
          ],
          files: ['component.njk', 'test.njk']
        };
      },

      async validateTemplate(request: any) {
        return {
          valid: true,
          errors: []
        };
      },

      async previewTemplate(request: any) {
        return {
          files: [{
            path: `src/${request.variables.name}.ts`,
            content: `export const ${request.variables.name} = () => {};`,
            size: 45
          }]
        };
      },

      simulateFailure() {
        serviceFailure = true;
      },

      restoreService() {
        serviceFailure = false;
      }
    };
  }

  function createMockGeneratorService() {
    return {
      async generate(request: any) {
        if (request.generator === 'nonexistent') {
          return {
            success: false,
            error: {
              message: 'Generator not found',
              code: 'GENERATOR_NOT_FOUND'
            }
          };
        }

        return {
          success: true,
          files: [{
            path: `${request.dest}/${request.variables?.name || 'component'}.ts`,
            created: true,
            size: 150
          }],
          duration: 250,
          dry: request.dry || false,
          wouldCreate: request.dry ? [{ path: 'src/component.ts', size: 150 }] : undefined
        };
      },

      async injectContent(request: any) {
        return {
          success: true,
          modified: true,
          skipped: false,
          linesAdded: 1
        };
      },

      async startGeneration(request: any) {
        return `job-${Date.now()}`;
      },

      async getGenerationStatus(jobId: string) {
        return {
          id: jobId,
          status: 'completed',
          progress: 100,
          result: {
            files: [{ path: 'src/component.ts', size: 150 }]
          }
        };
      },

      async generateWithEvents(request: any, eventService: any) {
        eventService.emit('generation.started', {
          timestamp: new Date(),
          generator: request.generator,
          template: request.template
        });

        eventService.emit('generation.progress', {
          progress: 50,
          currentStep: 'Rendering templates'
        });

        const result = await this.generate(request);

        if (result.success) {
          eventService.emit('generation.completed', {
            duration: result.duration,
            filesCreated: result.files.length
          });
        } else {
          eventService.emit('generation.error', {
            error: result.error,
            timestamp: new Date(),
            context: { generator: request.generator, template: request.template }
          });
        }

        return result;
      }
    };
  }

  function createMockFileSystemService() {
    return {
      async readFile(path: string) {
        return {
          content: 'file content',
          encoding: 'utf8',
          size: 12,
          lastModified: new Date()
        };
      },

      async writeFile(request: any) {
        return {
          success: true,
          path: request.path,
          size: request.content.length
        };
      },

      async listDirectory(path: string) {
        return {
          files: [
            { name: 'component.ts', size: 150, lastModified: new Date() },
            { name: 'service.ts', size: 200, lastModified: new Date() }
          ],
          directories: [
            { name: 'utils', lastModified: new Date() }
          ]
        };
      },

      async createDirectory(path: string) {
        return {
          success: true,
          path
        };
      },

      async checkPermissions(path: string) {
        return {
          readable: true,
          writable: true,
          executable: false
        };
      }
    };
  }

  function createMockEventService() {
    const events = new Map<string, Function[]>();

    return {
      on(event: string, handler: Function) {
        if (!events.has(event)) {
          events.set(event, []);
        }
        events.get(event)!.push(handler);
      },

      emit(event: string, data: any) {
        const handlers = events.get(event) || [];
        handlers.forEach(handler => handler(data));
      }
    };
  }

  function createMockOrchestrationService() {
    return {
      async generateWithFallback(request: any) {
        try {
          return await generatorService.generate(request);
        } catch (error) {
          // Use fallback logic
          return {
            success: true,
            files: [{ path: 'src/fallback.ts', created: true, size: 50 }],
            fallbackUsed: true,
            primaryServiceError: error
          };
        }
      }
    };
  }

  function createMockTransactionService() {
    const transactions = new Map<string, any>();

    return {
      async beginTransaction() {
        const id = `txn-${Date.now()}`;
        transactions.set(id, {
          id,
          status: 'active',
          steps: [],
          startTime: new Date()
        });
        return id;
      },

      async executeStep(transactionId: string, step: any) {
        const transaction = transactions.get(transactionId);
        if (!transaction) {
          throw new Error('Transaction not found');
        }

        transaction.steps.push(step);
        return { success: true, result: 'step completed' };
      },

      async commit(transactionId: string) {
        const transaction = transactions.get(transactionId);
        if (transaction) {
          transaction.status = 'committed';
          transaction.endTime = new Date();
        }
      },

      async rollback(transactionId: string) {
        const transaction = transactions.get(transactionId);
        if (transaction) {
          transaction.status = 'rolledback';
          transaction.endTime = new Date();
        }
      },

      async getTransactionStatus(transactionId: string) {
        return transactions.get(transactionId) || { status: 'not_found' };
      }
    };
  }

  function getDefaultForType(type: string): any {
    switch (type) {
      case 'string': return 'default';
      case 'boolean': return false;
      case 'number': return 0;
      case 'array': return [];
      case 'object': return {};
      default: return null;
    }
  }
});