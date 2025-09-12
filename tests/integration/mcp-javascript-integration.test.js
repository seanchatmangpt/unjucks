/**
 * MCP JavaScript Integration Test Suite
 * 
 * Comprehensive testing of MCP client integration after JavaScript conversion.
 * Tests that all MCP tools can be called, mocks work properly, and the 
 * integration layer functions without TypeScript dependencies.
 * 
 * Test Coverage:
 * ✅ MCP protocol definitions (JavaScript compatibility)
 * ✅ Mock client implementation
 * ✅ Server lifecycle management
 * ✅ Tool implementations (list, generate, help, inject, dry-run)
 * ✅ Integration bridge functionality
 * ✅ Performance and memory usage
 * ✅ Error handling and edge cases
 * ✅ Concurrent operations
 * ✅ External server integrations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { setTimeout as sleep } from 'timers/promises';

// Import our JavaScript MCP implementations
import { UnjucksMCPServer, createUnjucksMCPServer } from '../../src/mcp/server.js';
import { MCPRequestHandler } from '../../src/mcp/handlers/index.js';
import { 
  unjucksList, 
  unjucksGenerate, 
  unjucksHelp, 
  unjucksDryRun, 
  unjucksInject,
  TOOL_IMPLEMENTATIONS 
} from '../../src/mcp/tools/index.js';
import {
  createMCPError,
  createMCPResponse,
  createTextToolResult,
  createJSONToolResult,
  validateRequiredParams,
  sanitizeFilePath,
  withTimeout,
  handleToolError
} from '../../src/mcp/utils.js';
import { MCPErrorCode, TOOL_SCHEMAS, isValidMCPRequest } from '../../src/mcp/types.js';
import { MCPBridge, createMCPBridge } from '../../src/lib/mcp-integration.js';

describe('MCP JavaScript Integration Test Suite', () => {
  let testTempDir;
  let mcpServer;
  let requestHandler;
  let mcpBridge;
  let performanceMetrics = [];

  beforeAll(async () => {
    console.log('🚀 Setting up MCP JavaScript Integration Tests...');
    
    // Create temporary test directory
    testTempDir = join(process.cwd(), 'tests', 'temp', `mcp-js-test-${this.getDeterministicTimestamp()}`);
    await fs.mkdir(testTempDir, { recursive: true });
    
    // Initialize request handler
    requestHandler = new MCPRequestHandler();
    
    console.log(`✅ Test environment ready at: ${testTempDir}`);
  }, 30000);

  afterAll(async () => {
    console.log('🧹 Cleaning up MCP JavaScript Integration Tests...');
    
    // Stop server if running
    if (mcpServer) {
      try {
        await mcpServer.stop();
      } catch (error) {
        console.warn('Warning during server cleanup:', error.message);
      }
    }
    
    // Cleanup bridge
    if (mcpBridge) {
      try {
        await mcpBridge.destroy();
      } catch (error) {
        console.warn('Warning during bridge cleanup:', error.message);
      }
    }
    
    // Cleanup temp directory
    try {
      await fs.rm(testTempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Warning during temp directory cleanup:', error.message);
    }
    
    // Print performance summary
    if (performanceMetrics.length > 0) {
      const avgTime = performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / performanceMetrics.length;
      console.log(`📊 Average test execution time: ${avgTime.toFixed(2)}ms`);
    }
    
    console.log('✅ Cleanup complete');
  });

  beforeEach(() => {
    // Reset performance tracking
    performanceMetrics = [];
  });

  const measurePerformance = (testName, startTime) => {
    const duration = performance.now() - startTime;
    performanceMetrics.push({ testName, duration });
    return duration;
  };

  describe('🔧 MCP Protocol Definitions - JavaScript Compatibility', () => {
    it('should have valid MCP error codes as plain JavaScript objects', async () => {
      const startTime = performance.now();
      
      expect(typeof MCPErrorCode).toBe('object');
      expect(MCPErrorCode.ParseError).toBe(-32700);
      expect(MCPErrorCode.InvalidRequest).toBe(-32600);
      expect(MCPErrorCode.MethodNotFound).toBe(-32601);
      expect(MCPErrorCode.InvalidParams).toBe(-32602);
      expect(MCPErrorCode.InternalError).toBe(-32603);
      expect(MCPErrorCode.ServerError).toBe(-32000);
      
      const duration = measurePerformance('MCP Error Codes', startTime);
      expect(duration).toBeLessThan(10); // Should be instantaneous
    });

    it('should have valid tool schemas without TypeScript dependencies', async () => {
      const startTime = performance.now();
      
      expect(typeof TOOL_SCHEMAS).toBe('object');
      expect(TOOL_SCHEMAS.unjucks_list).toBeDefined();
      expect(TOOL_SCHEMAS.unjucks_generate).toBeDefined();
      expect(TOOL_SCHEMAS.unjucks_help).toBeDefined();
      expect(TOOL_SCHEMAS.unjucks_dry_run).toBeDefined();
      expect(TOOL_SCHEMAS.unjucks_inject).toBeDefined();
      
      // Validate schema structure
      const generateSchema = TOOL_SCHEMAS.unjucks_generate;
      expect(generateSchema.type).toBe('object');
      expect(generateSchema.properties).toBeDefined();
      expect(generateSchema.required).toEqual(['generator', 'template', 'dest']);
      expect(generateSchema.properties.generator.type).toBe('string');
      expect(generateSchema.properties.variables.type).toBe('object');
      
      const duration = measurePerformance('Tool Schemas', startTime);
      expect(duration).toBeLessThan(10);
    });

    it('should validate MCP requests correctly in JavaScript', async () => {
      const startTime = performance.now();
      
      // Valid request
      const validRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };
      
      expect(isValidMCPRequest(validRequest)).toBe(true);
      
      // Invalid requests
      expect(isValidMCPRequest(null)).toBe(false);
      expect(isValidMCPRequest({})).toBe(false);
      expect(isValidMCPRequest({ jsonrpc: '2.0' })).toBe(false);
      expect(isValidMCPRequest({ jsonrpc: '2.0', method: 'test' })).toBe(false); // No id
      expect(isValidMCPRequest({ jsonrpc: '1.0', id: 1, method: 'test' })).toBe(false); // Wrong version
      
      const duration = measurePerformance('MCP Request Validation', startTime);
      expect(duration).toBeLessThan(10);
    });

    it('should create proper MCP responses and errors', async () => {
      const startTime = performance.now();
      
      // Test response creation
      const response = createMCPResponse(123, { data: 'test' });
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(123);
      expect(response.result.data).toBe('test');
      
      // Test error creation
      const error = createMCPError(456, MCPErrorCode.InvalidParams, 'Test error');
      expect(error.jsonrpc).toBe('2.0');
      expect(error.id).toBe(456);
      expect(error.error.code).toBe(MCPErrorCode.InvalidParams);
      expect(error.error.message).toBe('Test error');
      
      const duration = measurePerformance('MCP Response Creation', startTime);
      expect(duration).toBeLessThan(10);
    });

    it('should create tool results in proper format', async () => {
      const startTime = performance.now();
      
      // Text tool result
      const textResult = createTextToolResult('Hello World', { key: 'value' });
      expect(textResult.content).toHaveLength(1);
      expect(textResult.content[0].type).toBe('text');
      expect(textResult.content[0].text).toBe('Hello World');
      expect(textResult._meta.key).toBe('value');
      
      // JSON tool result
      const jsonData = { message: 'success', count: 42 };
      const jsonResult = createJSONToolResult(jsonData, { operation: 'test' });
      expect(jsonResult.content).toHaveLength(1);
      expect(jsonResult.content[0].type).toBe('text');
      
      const parsedContent = JSON.parse(jsonResult.content[0].text);
      expect(parsedContent.message).toBe('success');
      expect(parsedContent.count).toBe(42);
      expect(jsonResult._meta.operation).toBe('test');
      
      const duration = measurePerformance('Tool Result Creation', startTime);
      expect(duration).toBeLessThan(10);
    });
  });

  describe('🎭 Mock Client Implementation', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = {
        connected: false,
        requests: [],
        responses: new Map(),
        
        connect: async () => {
          await sleep(100); // Simulate connection delay
          mockClient.connected = true;
          return { success: true };
        },
        
        disconnect: async () => {
          mockClient.connected = false;
          mockClient.requests = [];
          mockClient.responses.clear();
          return { success: true };
        },
        
        call: async (method, params) => {
          if (!mockClient.connected) {
            throw new Error('Not connected to MCP server');
          }
          
          const requestId = this.getDeterministicTimestamp() + Math.random();
          mockClient.requests.push({ id: requestId, method, params });
          
          // Simulate different response types
          if (method === 'tools/list') {
            return createMCPResponse(requestId, {
              tools: Object.keys(TOOL_SCHEMAS).map(name => ({
                name,
                description: `${name} tool`,
                inputSchema: TOOL_SCHEMAS[name]
              }))
            });
          } else if (method === 'tools/call') {
            const toolResult = await mockClient.callTool(params.name, params.arguments || {});
            return createMCPResponse(requestId, toolResult);
          } else {
            return createMCPError(requestId, MCPErrorCode.MethodNotFound, `Method ${method} not found`);
          }
        },
        
        callTool: async (toolName, args) => {
          // Mock tool implementations
          switch (toolName) {
            case 'unjucks_list':
              return createJSONToolResult({
                generators: [
                  { name: 'component', templates: ['basic', 'advanced'] },
                  { name: 'api', templates: ['rest', 'graphql'] }
                ]
              });
              
            case 'unjucks_generate':
              return createJSONToolResult({
                files: [`${args.dest}/${args.variables?.name || 'generated'}.js`],
                summary: { created: 1, updated: 0, skipped: 0 }
              });
              
            case 'unjucks_help':
              return createTextToolResult(
                `Help for ${args.generator}/${args.template}:\nThis is a mock help response.`
              );
              
            case 'unjucks_dry_run':
              return createJSONToolResult({
                files: [{
                  path: `${args.dest}/${args.variables?.name || 'preview'}.js`,
                  action: 'create',
                  content: `// Mock dry run content for ${args.variables?.name || 'preview'}`
                }]
              });
              
            case 'unjucks_inject':
              return createJSONToolResult({
                file: args.file,
                action: 'injected',
                linesAdded: args.content.split('\n').length
              });
              
            default:
              throw new Error(`Unknown tool: ${toolName}`);
          }
        }
      };
    });

    it('should connect and disconnect properly', async () => {
      const startTime = performance.now();
      
      expect(mockClient.connected).toBe(false);
      
      const connectResult = await mockClient.connect();
      expect(connectResult.success).toBe(true);
      expect(mockClient.connected).toBe(true);
      
      const disconnectResult = await mockClient.disconnect();
      expect(disconnectResult.success).toBe(true);
      expect(mockClient.connected).toBe(false);
      
      const duration = measurePerformance('Mock Client Connection', startTime);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle tools/list requests', async () => {
      const startTime = performance.now();
      
      await mockClient.connect();
      const response = await mockClient.call('tools/list');
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeInstanceOf(Array);
      expect(response.result.tools.length).toBeGreaterThan(0);
      
      const toolNames = response.result.tools.map(t => t.name);
      expect(toolNames).toContain('unjucks_list');
      expect(toolNames).toContain('unjucks_generate');
      expect(toolNames).toContain('unjucks_help');
      
      const duration = measurePerformance('Mock Tools List', startTime);
      expect(duration).toBeLessThan(500);
    });

    it('should handle tool execution with proper parameters', async () => {
      const startTime = performance.now();
      
      await mockClient.connect();
      
      // Test unjucks_list tool
      const listResponse = await mockClient.call('tools/call', {
        name: 'unjucks_list',
        arguments: { detailed: true }
      });
      
      expect(listResponse.result.content).toHaveLength(1);
      const listData = JSON.parse(listResponse.result.content[0].text);
      expect(listData.generators).toBeInstanceOf(Array);
      expect(listData.generators[0].name).toBe('component');
      
      // Test unjucks_generate tool
      const generateResponse = await mockClient.call('tools/call', {
        name: 'unjucks_generate',
        arguments: {
          generator: 'component',
          template: 'basic',
          dest: './src/components',
          variables: { name: 'Button' }
        }
      });
      
      expect(generateResponse.result.content).toHaveLength(1);
      const generateData = JSON.parse(generateResponse.result.content[0].text);
      expect(generateData.files).toContain('./src/components/Button.js');
      expect(generateData.summary.created).toBe(1);
      
      const duration = measurePerformance('Mock Tool Execution', startTime);
      expect(duration).toBeLessThan(500);
    });

    it('should handle errors gracefully', async () => {
      const startTime = performance.now();
      
      // Test without connection
      try {
        await mockClient.call('tools/list');
        expect.fail('Should have thrown connection error');
      } catch (error) {
        expect(error.message).toContain('Not connected');
      }
      
      await mockClient.connect();
      
      // Test invalid method
      const invalidResponse = await mockClient.call('invalid/method');
      expect(invalidResponse.error).toBeDefined();
      expect(invalidResponse.error.code).toBe(MCPErrorCode.MethodNotFound);
      
      // Test invalid tool
      try {
        await mockClient.callTool('invalid_tool', {});
        expect.fail('Should have thrown unknown tool error');
      } catch (error) {
        expect(error.message).toContain('Unknown tool');
      }
      
      const duration = measurePerformance('Mock Error Handling', startTime);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('🖥️ Server Lifecycle Management', () => {
    it('should create and start MCP server', async () => {
      const startTime = performance.now();
      
      // Create server instance
      const server = new UnjucksMCPServer();
      expect(server).toBeInstanceOf(UnjucksMCPServer);
      expect(server.isShuttingDown).toBe(false);
      
      // Test server stats
      const stats = server.getStats();
      expect(stats.uptime).toBeGreaterThan(0);
      expect(stats.requestsProcessed).toBe(0);
      expect(stats.isShuttingDown).toBe(false);
      
      const duration = measurePerformance('Server Creation', startTime);
      expect(duration).toBeLessThan(100);
    });

    it('should validate MCP request and notification formats', async () => {
      const startTime = performance.now();
      
      const server = new UnjucksMCPServer();
      
      // Valid request
      const validRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };
      expect(server.isValidMCPRequest(validRequest)).toBe(true);
      
      // Valid notification
      const validNotification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      };
      expect(server.isValidMCPNotification(validNotification)).toBe(true);
      
      // Invalid formats
      expect(server.isValidMCPRequest({ jsonrpc: '2.0', method: 'test' })).toBe(false); // No id
      expect(server.isValidMCPNotification({ jsonrpc: '2.0', id: 1, method: 'test' })).toBe(false); // Has id
      
      const duration = measurePerformance('Request Validation', startTime);
      expect(duration).toBeLessThan(50);
    });

    it('should handle request processing through handler', async () => {
      const startTime = performance.now();
      
      const handler = new MCPRequestHandler();
      
      // Test server info
      const serverInfo = handler.getServerInfo();
      expect(serverInfo.name).toBeDefined();
      expect(serverInfo.version).toBeDefined();
      expect(serverInfo.protocolVersion).toBeDefined();
      
      // Test capabilities
      const capabilities = handler.getCapabilities();
      expect(capabilities.tools).toBeDefined();
      expect(capabilities.tools.listChanged).toBe(false);
      
      const duration = measurePerformance('Request Handler', startTime);
      expect(duration).toBeLessThan(50);
    });

    it('should gracefully shut down server', async () => {
      const startTime = performance.now();
      
      const server = new UnjucksMCPServer();
      expect(server.isShuttingDown).toBe(false);
      
      await server.stop();
      expect(server.isShuttingDown).toBe(true);
      
      const stats = server.getStats();
      expect(stats.isShuttingDown).toBe(true);
      
      const duration = measurePerformance('Server Shutdown', startTime);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('🔨 Tool Implementations', () => {
    beforeEach(async () => {
      // Create test templates
      const templatesDir = join(testTempDir, '_templates', 'component', 'basic');
      await fs.mkdir(templatesDir, { recursive: true });
      
      await fs.writeFile(join(templatesDir, 'component.njk'), `---
to: "{{ dest }}/{{ name | pascalCase }}.jsx"
---
import React from 'react';

export const {{ name | pascalCase }} = () => {
  return <div className="{{ name | kebabCase }}">{{ name }}</div>;
};`);
    });

    it('should execute unjucks_list tool', async () => {
      const startTime = performance.now();
      
      const params = { detailed: true };
      const result = await unjucksList(params);
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      
      const data = JSON.parse(result.content[0].text);
      expect(data.generators).toBeInstanceOf(Array);
      
      // Should find our test template
      const componentGenerator = data.generators.find(g => g.name === 'component');
      if (componentGenerator) {
        const templateNames = componentGenerator.templates.map(t => t.name);
        expect(templateNames).toContain('new');
      }
      
      const duration = measurePerformance('List Tool', startTime);
      expect(duration).toBeLessThan(2000);
    });

    it('should execute unjucks_help tool', async () => {
      const startTime = performance.now();
      
      const params = {
        generator: 'component',
        template: 'new'
      };
      
      const result = await unjucksHelp(params);
      
      expect(result.content).toHaveLength(2); // Help tool returns 2 content items
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('component');
      expect(result.content[0].text).toContain('new');
      
      const duration = measurePerformance('Help Tool', startTime);
      expect(duration).toBeLessThan(1000);
    });

    it('should execute unjucks_dry_run tool', async () => {
      const startTime = performance.now();
      
      const params = {
        generator: 'component',
        template: 'new',
        dest: join(testTempDir, 'output'),
        variables: { name: 'TestButton' }
      };
      
      const result = await unjucksDryRun(params);
      
      expect(result.content).toHaveLength(2); // Dry run returns 2 content items
      const data = JSON.parse(result.content[1].text); // Parse the JSON content (second item)
      
      expect(data.preview.files).toBeInstanceOf(Array);
      expect(data.preview.files.length).toBeGreaterThan(0);
      
      const testFile = data.preview.files.find(f => f.path.includes('TestButton'));
      if (testFile) {
        expect(testFile.action).toBe('create');
      }
      
      const duration = measurePerformance('Dry Run Tool', startTime);
      expect(duration).toBeLessThan(2000);
    });

    it('should execute unjucks_generate tool', async () => {
      const startTime = performance.now();
      
      const outputDir = join(testTempDir, 'generated');
      await fs.mkdir(outputDir, { recursive: true });
      
      const params = {
        generator: 'component',
        template: 'new',
        dest: outputDir,
        variables: { name: 'GeneratedButton' },
        force: true
      };
      
      const result = await unjucksGenerate(params);
      
      expect(result.content).toHaveLength(2); // Generate returns 2 content items
      const data = JSON.parse(result.content[1].text); // Parse the JSON content (second item)
      
      expect(data.result.summary).toBeDefined();
      expect(data.result.summary.created).toBeGreaterThan(0);
      
      // Verify file was actually created
      const expectedFile = join(outputDir, 'GeneratedButton.jsx');
      const fileExists = await fs.access(expectedFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      if (fileExists) {
        const fileContent = await fs.readFile(expectedFile, 'utf-8');
        expect(fileContent).toContain('GeneratedButton');
        expect(fileContent).toContain('generated-button');
      }
      
      const duration = measurePerformance('Generate Tool', startTime);
      expect(duration).toBeLessThan(3000);
    });

    it('should execute unjucks_inject tool', async () => {
      const startTime = performance.now();
      
      // Create target file
      const targetFile = join(testTempDir, 'target.js');
      const initialContent = `const existing = 'code';
export default existing;`;
      
      await fs.writeFile(targetFile, initialContent);
      
      const params = {
        file: targetFile,
        content: '\nconst injected = "new content";',
        after: 'existing = \'code\';',
        force: true
      };
      
      const result = await unjucksInject(params);
      
      expect(result.content).toHaveLength(2); // Inject returns 2 content items
      const data = JSON.parse(result.content[1].text); // Parse the JSON content (second item)
      
      expect(data.success).toBe(true);
      expect(data.file).toBe(targetFile);
      expect(data.action).toBeDefined();
      
      // Verify injection worked
      const updatedContent = await fs.readFile(targetFile, 'utf-8');
      expect(updatedContent).toContain('injected = "new content"');
      
      const duration = measurePerformance('Inject Tool', startTime);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle tool validation and errors', async () => {
      const startTime = performance.now();
      
      // Test missing required parameters
      try {
        await unjucksGenerate({}); // Missing required params
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error.message).toContain('required');
      }
      
      // Test invalid file paths
      try {
        await unjucksInject({
          file: '/invalid/path/that/does/not/exist.js',
          content: 'test'
        });
        expect.fail('Should have thrown file error');
      } catch (error) {
        expect(error.message).toMatch(/file|exist|path/i);
      }
      
      const duration = measurePerformance('Tool Validation', startTime);
      expect(duration).toBeLessThan(1000);
    });

    it('should validate all tool schemas match implementations', async () => {
      const startTime = performance.now();
      
      // Verify all tools in TOOL_IMPLEMENTATIONS have corresponding schemas
      for (const toolName of Object.keys(TOOL_IMPLEMENTATIONS)) {
        expect(TOOL_SCHEMAS[toolName]).toBeDefined();
        
        const schema = TOOL_SCHEMAS[toolName];
        expect(schema.type).toBe('object');
        expect(schema.properties).toBeDefined();
        
        if (schema.required) {
          expect(Array.isArray(schema.required)).toBe(true);
        }
      }
      
      // Verify all schemas have corresponding implementations
      for (const schemaName of Object.keys(TOOL_SCHEMAS)) {
        expect(TOOL_IMPLEMENTATIONS[schemaName]).toBeDefined();
        expect(typeof TOOL_IMPLEMENTATIONS[schemaName]).toBe('function');
      }
      
      const duration = measurePerformance('Schema Validation', startTime);
      expect(duration).toBeLessThan(50);
    });
  });

  describe('🌉 Integration Bridge Functionality', () => {
    beforeEach(async () => {
      // Create bridge with test configuration
      mcpBridge = new MCPBridge({
        debugMode: true,
        hooksEnabled: false, // Disable hooks for testing
        realtimeSync: false, // Disable real-time sync for testing
        timeouts: {
          swarmRequest: 5000,
          unjucksRequest: 5000,
          memorySync: 1000
        }
      });
    });

    afterEach(async () => {
      if (mcpBridge) {
        await mcpBridge.destroy();
        mcpBridge = null;
      }
    });

    it('should initialize bridge with proper configuration', async () => {
      const startTime = performance.now();
      
      expect(mcpBridge).toBeInstanceOf(MCPBridge);
      expect(mcpBridge.isInitialized).toBe(false);
      
      const status = mcpBridge.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.connections.swarm).toBe(false);
      expect(status.connections.unjucks).toBe(false);
      expect(status.memory).toBeDefined();
      expect(status.stats).toBeDefined();
      
      const duration = measurePerformance('Bridge Initialization', startTime);
      expect(duration).toBeLessThan(100);
    });

    it('should convert swarm tasks to unjucks parameters', async () => {
      const startTime = performance.now();
      
      const swarmTask = {
        id: 'test-task-1',
        type: 'generate',
        description: 'Generate a React component',
        parameters: {
          generator: 'component',
          template: 'basic',
          dest: './src/components',
          variables: { name: 'TestComponent' },
          force: false,
          dry: false
        }
      };
      
      const unjucksParams = await mcpBridge.swarmToUnjucks(swarmTask);
      
      expect(unjucksParams).toBeDefined();
      expect(unjucksParams.generator).toBe('component');
      expect(unjucksParams.template).toBe('basic');
      expect(unjucksParams.dest).toBe('./src/components');
      expect(unjucksParams.variables.name).toBe('TestComponent');
      expect(unjucksParams.force).toBe(false);
      expect(unjucksParams.dry).toBe(false);
      
      const duration = measurePerformance('Task Conversion', startTime);
      expect(duration).toBeLessThan(500);
    });

    it('should handle different task types', async () => {
      const startTime = performance.now();
      
      const tasks = [
        {
          id: 'scaffold-1',
          type: 'scaffold',
          description: 'Scaffold new project',
          parameters: {
            type: 'project',
            name: 'my-app',
            dest: './projects'
          }
        },
        {
          id: 'refactor-1',
          type: 'refactor',
          description: 'Refactor existing file',
          parameters: {
            file: './src/old-file.js',
            content: 'new content',
            after: 'existing line'
          }
        },
        {
          id: 'document-1',
          type: 'document',
          description: 'Generate documentation',
          parameters: {
            docType: 'api',
            title: 'API Documentation',
            dest: './docs'
          }
        }
      ];
      
      for (const task of tasks) {
        const result = await mcpBridge.swarmToUnjucks(task);
        expect(result).toBeDefined();
        
        if (task.type === 'scaffold') {
          expect(result.generator).toBe('scaffold');
          expect(result.variables.projectName).toBe('my-app');
        } else if (task.type === 'refactor') {
          expect(result.file).toBe('./src/old-file.js');
          expect(result.content).toBe('new content');
        } else if (task.type === 'document') {
          expect(result.generator).toBe('docs');
          expect(result.variables.title).toBe('API Documentation');
        }
      }
      
      const duration = measurePerformance('Multiple Task Types', startTime);
      expect(duration).toBeLessThan(1000);
    });

    it('should manage memory and synchronization', async () => {
      const startTime = performance.now();
      
      // Test memory initialization
      expect(mcpBridge.memory).toBeDefined();
      expect(mcpBridge.memory.templates).toBeDefined();
      expect(mcpBridge.memory.agents).toBeDefined();
      expect(mcpBridge.memory.tasks).toBeDefined();
      expect(mcpBridge.memory.workflows).toBeDefined();
      
      // Test template variable synchronization
      const variables = await mcpBridge.syncTemplateVariables('component', 'basic', {
        name: 'SyncTest',
        description: 'Test component for sync'
      });
      
      expect(variables).toBeDefined();
      expect(variables.name).toBe('SyncTest');
      expect(variables.description).toBe('Test component for sync');
      
      const duration = measurePerformance('Memory Management', startTime);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle integration schema storage', async () => {
      const startTime = performance.now();
      
      await mcpBridge.storeIntegrationSchema();
      
      const schema = mcpBridge.memory.templates.metadata.integrationSchema;
      expect(schema).toBeDefined();
      expect(schema.version).toBeDefined();
      expect(schema.bridge).toBe('mcp-integration');
      expect(schema.capabilities).toBeDefined();
      expect(schema.capabilities.swarmToUnjucks).toBe(true);
      expect(schema.capabilities.unjucksToSwarm).toBe(true);
      expect(schema.capabilities.templateVariableSync).toBe(true);
      
      const duration = measurePerformance('Schema Storage', startTime);
      expect(duration).toBeLessThan(500);
    });

    it('should execute JTBD workflows', async () => {
      const startTime = performance.now();
      
      const workflow = {
        id: 'test-workflow-1',
        name: 'Component Generation Workflow',
        description: 'Generate and document a component',
        job: 'Create a reusable UI component with documentation',
        steps: [
          {
            action: 'analyze',
            description: 'Analyze template requirements',
            parameters: { template: 'component/basic' }
          },
          {
            action: 'validate',
            description: 'Validate output directory',
            parameters: { files: [join(testTempDir, 'workflow-test')] }
          }
        ]
      };
      
      const result = await mcpBridge.orchestrateJTBD(workflow);
      
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      
      const analyzeResult = result.results.find(r => r.action === 'analyze');
      expect(analyzeResult.success).toBe(true);
      
      const validateResult = result.results.find(r => r.action === 'validate');
      expect(validateResult.success).toBe(false); // Directory doesn't exist
      
      const duration = measurePerformance('JTBD Workflow', startTime);
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('⚡ Performance and Memory Usage', () => {
    it('should handle rapid sequential operations', async () => {
      const startTime = performance.now();
      const operations = [];
      
      for (let i = 0; i < 100; i++) {
        operations.push(
          unjucksList({ detailed: false })
        );
      }
      
      const results = await Promise.all(operations);
      const duration = measurePerformance('Sequential Operations', startTime);
      
      expect(results).toHaveLength(100);
      expect(results.every(r => r.content && r.content[0])).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should maintain memory efficiency during operations', async () => {
      const startTime = performance.now();
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform memory-intensive operations
      for (let i = 0; i < 50; i++) {
        const params = {
          generator: 'component',
          template: 'basic',
          dest: join(testTempDir, `mem-test-${i}`),
          variables: { name: `Component${i}` }
        };
        
        await unjucksDryRun(params);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;
      const duration = measurePerformance('Memory Efficiency', startTime);
      
      expect(memoryGrowthMB).toBeLessThan(100); // Should not grow more than 100MB
      expect(duration).toBeLessThan(30000);
      
      console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB over ${duration.toFixed(2)}ms`);
    });

    it('should handle concurrent tool executions', async () => {
      const startTime = performance.now();
      
      const concurrentOperations = [
        unjucksList({ detailed: true }),
        unjucksHelp({ generator: 'component', template: 'basic' }),
        unjucksDryRun({
          generator: 'component',
          template: 'basic',
          dest: join(testTempDir, 'concurrent-1'),
          variables: { name: 'ConcurrentTest1' }
        }),
        unjucksDryRun({
          generator: 'component',
          template: 'basic',
          dest: join(testTempDir, 'concurrent-2'),
          variables: { name: 'ConcurrentTest2' }
        })
      ];
      
      const results = await Promise.all(concurrentOperations);
      const duration = measurePerformance('Concurrent Operations', startTime);
      
      expect(results).toHaveLength(4);
      expect(results.every(r => r.content && r.content[0])).toBe(true);
      expect(duration).toBeLessThan(5000);
    });

    it('should benchmark utility function performance', async () => {
      const startTime = performance.now();
      const iterations = 10000;
      
      // Test parameter validation
      for (let i = 0; i < iterations; i++) {
        validateRequiredParams({ test: 'value' }, ['test']);
      }
      
      // Test path sanitization
      for (let i = 0; i < iterations; i++) {
        sanitizeFilePath('/path/to/../file.js');
      }
      
      const duration = measurePerformance('Utility Benchmarks', startTime);
      
      // Should handle 10k operations quickly
      expect(duration).toBeLessThan(1000);
      
      console.log(`Utility functions: ${iterations} operations in ${duration.toFixed(2)}ms`);
    });
  });

  describe('🚨 Error Handling and Edge Cases', () => {
    it('should handle malformed MCP requests gracefully', async () => {
      const startTime = performance.now();
      const handler = new MCPRequestHandler();
      
      const malformedRequests = [
        null,
        undefined,
        {},
        { jsonrpc: '1.0' }, // Wrong version
        { jsonrpc: '2.0' }, // Missing method
        { jsonrpc: '2.0', method: 'test' }, // Missing id
        { jsonrpc: '2.0', id: 1, method: '' }, // Empty method
        { jsonrpc: '2.0', id: 1, method: 'invalid/method' } // Invalid method
      ];
      
      for (const request of malformedRequests) {
        try {
          const response = await handler.handleRequest(request);
          
          if (response.error) {
            expect(response.error.code).toBeDefined();
            expect(response.error.message).toBeDefined();
          }
        } catch (error) {
          // Some requests should throw immediately
          expect(error).toBeDefined();
        }
      }
      
      const duration = measurePerformance('Malformed Requests', startTime);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle filesystem errors appropriately', async () => {
      const startTime = performance.now();
      
      // Test with non-existent directories
      try {
        await unjucksGenerate({
          generator: 'component',
          template: 'basic',
          dest: '/invalid/nonexistent/directory/path',
          variables: { name: 'Test' }
        });
        expect.fail('Should have thrown filesystem error');
      } catch (error) {
        expect(error.message).toMatch(/directory|path|permission/i);
      }
      
      // Test with read-only target (if possible to simulate)
      const readOnlyPath = join(testTempDir, 'readonly');
      await fs.mkdir(readOnlyPath, { recursive: true });
      
      try {
        // Try to change permissions to read-only (may not work on all systems)
        await fs.chmod(readOnlyPath, 0o444);
        
        await unjucksGenerate({
          generator: 'component',
          template: 'basic',
          dest: readOnlyPath,
          variables: { name: 'ReadOnlyTest' }
        });
        
        // If it doesn't throw, restore permissions and continue
        await fs.chmod(readOnlyPath, 0o755);
      } catch (error) {
        // Expected - restore permissions
        try {
          await fs.chmod(readOnlyPath, 0o755);
        } catch {}
        
        expect(error.message).toMatch(/permission|access|denied/i);
      }
      
      const duration = measurePerformance('Filesystem Errors', startTime);
      expect(duration).toBeLessThan(2000);
    });

    it('should handle timeout scenarios', async () => {
      const startTime = performance.now();
      
      // Test utility timeout wrapper
      const slowOperation = () => new Promise(resolve => setTimeout(() => resolve('done'), 2000));
      
      try {
        await withTimeout(slowOperation(), 500);
        expect.fail('Should have timed out');
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
      
      // Test successful operation within timeout
      const fastOperation = () => new Promise(resolve => setTimeout(() => resolve('fast'), 100));
      const result = await withTimeout(fastOperation(), 500);
      expect(result).toBe('fast');
      
      const duration = measurePerformance('Timeout Handling', startTime);
      expect(duration).toBeLessThan(3000);
    });

    it('should handle invalid template data', async () => {
      const startTime = performance.now();
      
      // Create invalid template
      const invalidTemplateDir = join(testTempDir, '_templates', 'invalid', 'broken');
      await fs.mkdir(invalidTemplateDir, { recursive: true });
      
      // Template with malformed frontmatter
      await fs.writeFile(join(invalidTemplateDir, 'broken.njk'), `---
invalid: yaml: content: [unclosed
---
This template has broken frontmatter`);
      
      try {
        await unjucksGenerate({
          generator: 'invalid',
          template: 'broken',
          dest: join(testTempDir, 'invalid-output'),
          variables: { name: 'Test' }
        });
        
        // May succeed with degraded functionality or throw
      } catch (error) {
        expect(error.message).toMatch(/template|parse|frontmatter|yaml/i);
      }
      
      const duration = measurePerformance('Invalid Template', startTime);
      expect(duration).toBeLessThan(2000);
    });

    it('should handle bridge errors and recovery', async () => {
      const startTime = performance.now();
      
      const bridge = new MCPBridge({
        debugMode: true,
        hooksEnabled: false,
        realtimeSync: false
      });
      
      // Test unsupported task types
      const unsupportedTask = {
        id: 'unsupported-1',
        type: 'unsupported',
        description: 'Unsupported task type',
        parameters: {}
      };
      
      const result = await bridge.swarmToUnjucks(unsupportedTask);
      expect(result).toBeNull();
      
      // Test bridge status during error conditions
      const status = bridge.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.connections.swarm).toBe(false);
      expect(status.connections.unjucks).toBe(false);
      
      await bridge.destroy();
      
      const duration = measurePerformance('Bridge Error Handling', startTime);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('🔗 External Server Integration', () => {
    // Note: These tests use mock implementations since external servers may not be available
    
    it('should simulate Claude Flow swarm operations', async () => {
      const startTime = performance.now();
      
      // Mock Claude Flow responses
      const mockClaudeFlow = {
        swarmInit: () => ({
          success: true,
          result: { swarmId: 'cf-swarm-123', topology: 'mesh' }
        }),
        agentSpawn: () => ({
          success: true,
          result: { agentId: 'cf-agent-456', type: 'coder' }
        }),
        taskOrchestrate: () => ({
          success: true,
          result: { taskId: 'cf-task-789', status: 'queued' }
        })
      };
      
      const swarmResult = mockClaudeFlow.swarmInit();
      expect(swarmResult.success).toBe(true);
      expect(swarmResult.result.swarmId).toBeDefined();
      
      const agentResult = mockClaudeFlow.agentSpawn();
      expect(agentResult.success).toBe(true);
      expect(agentResult.result.agentId).toBeDefined();
      
      const taskResult = mockClaudeFlow.taskOrchestrate();
      expect(taskResult.success).toBe(true);
      expect(taskResult.result.taskId).toBeDefined();
      
      const duration = measurePerformance('Claude Flow Mock', startTime);
      expect(duration).toBeLessThan(100);
    });

    it('should simulate RUV Swarm WASM operations', async () => {
      const startTime = performance.now();
      
      // Mock RUV Swarm responses
      const mockRuvSwarm = {
        featuresDetect: () => ({
          success: true,
          result: { wasm: true, simd: true, memory: '1GB' }
        }),
        benchmarkRun: () => ({
          success: true,
          result: { 
            benchmarks: [
              { name: 'wasm-math', executionTime: 45.2 },
              { name: 'simd-vectors', executionTime: 23.1 }
            ]
          }
        })
      };
      
      const featuresResult = mockRuvSwarm.featuresDetect();
      expect(featuresResult.success).toBe(true);
      expect(featuresResult.result.wasm).toBe(true);
      expect(featuresResult.result.simd).toBe(true);
      
      const benchmarkResult = mockRuvSwarm.benchmarkRun();
      expect(benchmarkResult.success).toBe(true);
      expect(benchmarkResult.result.benchmarks.length).toBe(2);
      
      const duration = measurePerformance('RUV Swarm Mock', startTime);
      expect(duration).toBeLessThan(100);
    });

    it('should simulate Flow Nexus authentication flow', async () => {
      const startTime = performance.now();
      
      // Mock Flow Nexus responses (with some failures to simulate partial working state)
      const mockFlowNexus = {
        authStatus: () => ({
          success: Math.random() > 0.3,
          result: { status: 'authenticated', user: 'test-user' },
          error: Math.random() <= 0.3 ? 'Auth service temporarily unavailable' : undefined
        }),
        sandboxCreate: () => ({
          success: Math.random() > 0.2,
          result: { sandboxId: 'fn-sandbox-321', status: 'running' },
          error: Math.random() <= 0.2 ? 'Sandbox quota exceeded' : undefined
        })
      };
      
      // Test multiple attempts to simulate real conditions
      let successCount = 0;
      const attempts = 10;
      
      for (let i = 0; i < attempts; i++) {
        const authResult = mockFlowNexus.authStatus();
        if (authResult.success) {
          successCount++;
          expect(authResult.result.status).toBe('authenticated');
        }
      }
      
      // Should have some successes (simulating partial availability)
      expect(successCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThan(attempts); // But not 100% success
      
      const duration = measurePerformance('Flow Nexus Mock', startTime);
      expect(duration).toBeLessThan(500);
      
      console.log(`Flow Nexus simulation: ${successCount}/${attempts} successful calls`);
    });

    it('should handle integration communication patterns', async () => {
      const startTime = performance.now();
      
      // Simulate integration communication
      const integrationBridge = new EventEmitter();
      const messages = [];
      
      integrationBridge.on('swarm-to-unjucks', (data) => {
        messages.push({ type: 'swarm-to-unjucks', data });
      });
      
      integrationBridge.on('unjucks-to-swarm', (data) => {
        messages.push({ type: 'unjucks-to-swarm', data });
      });
      
      // Simulate message flow
      integrationBridge.emit('swarm-to-unjucks', {
        taskId: 'integration-test-1',
        operation: 'generate',
        parameters: { generator: 'component', template: 'basic' }
      });
      
      integrationBridge.emit('unjucks-to-swarm', {
        taskId: 'integration-test-1',
        result: { success: true, files: ['component.jsx'] }
      });
      
      expect(messages).toHaveLength(2);
      expect(messages[0].type).toBe('swarm-to-unjucks');
      expect(messages[1].type).toBe('unjucks-to-swarm');
      expect(messages[1].data.result.success).toBe(true);
      
      const duration = measurePerformance('Integration Communication', startTime);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('📊 Final Integration Validation', () => {
    it('should validate complete MCP integration workflow', async () => {
      const startTime = performance.now();
      
      // 1. List available tools
      const listResult = await unjucksList({ detailed: true });
      expect(listResult.content).toHaveLength(1);
      
      // 2. Get help for a specific tool
      const helpResult = await unjucksHelp({
        generator: 'component',
        template: 'basic'
      });
      expect(helpResult.content[0].text).toContain('component');
      
      // 3. Dry run to preview generation
      const dryRunResult = await unjucksDryRun({
        generator: 'component',
        template: 'basic',
        dest: join(testTempDir, 'final-test'),
        variables: { name: 'FinalTestComponent' }
      });
      const dryRunData = JSON.parse(dryRunResult.content[0].text);
      expect(dryRunData.files.length).toBeGreaterThan(0);
      
      // 4. Actually generate the files
      const generateResult = await unjucksGenerate({
        generator: 'component',
        template: 'basic',
        dest: join(testTempDir, 'final-test'),
        variables: { name: 'FinalTestComponent' },
        force: true
      });
      const generateData = JSON.parse(generateResult.content[0].text);
      expect(generateData.summary.created).toBeGreaterThan(0);
      
      // 5. Verify files were created
      const expectedFile = join(testTempDir, 'final-test', 'FinalTestComponent.jsx');
      const fileExists = await fs.access(expectedFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      // 6. Inject additional content
      const injectResult = await unjucksInject({
        file: expectedFile,
        content: '\n// Added by integration test',
        append: true,
        force: true
      });
      const injectData = JSON.parse(injectResult.content[0].text);
      expect(injectData.success).toBe(true);
      
      const duration = measurePerformance('Complete Integration Workflow', startTime);
      expect(duration).toBeLessThan(10000);
      
      console.log(`✅ Complete MCP integration workflow validated in ${duration.toFixed(2)}ms`);
    });

    it('should validate JavaScript runtime compatibility', async () => {
      const startTime = performance.now();
      
      // Test that all imports work in JavaScript
      expect(UnjucksMCPServer).toBeDefined();
      expect(MCPRequestHandler).toBeDefined();
      expect(unjucksList).toBeDefined();
      expect(unjucksGenerate).toBeDefined();
      expect(createMCPError).toBeDefined();
      expect(MCPErrorCode).toBeDefined();
      expect(isValidMCPRequest).toBeDefined();
      
      // Test that JSDoc types are properly handled (no runtime errors)
      const request = { jsonrpc: '2.0', id: 1, method: 'test' };
      expect(() => isValidMCPRequest(request)).not.toThrow();
      
      // Test that all tool schemas are valid JavaScript objects
      for (const [toolName, schema] of Object.entries(TOOL_SCHEMAS)) {
        expect(typeof schema).toBe('object');
        expect(schema.type).toBe('object');
        expect(schema.properties).toBeDefined();
        
        // Verify schema can be JSON serialized (no circular references)
        expect(() => JSON.stringify(schema)).not.toThrow();
      }
      
      const duration = measurePerformance('JavaScript Compatibility', startTime);
      expect(duration).toBeLessThan(100);
    });

    it('should measure overall performance characteristics', async () => {
      const startTime = performance.now();
      
      // Collect all performance metrics from this test run
      const totalTests = performanceMetrics.length;
      const totalDuration = performanceMetrics.reduce((sum, m) => sum + m.duration, 0);
      const averageDuration = totalDuration / totalTests;
      const slowestTest = performanceMetrics.reduce((max, m) => m.duration > max.duration ? m : max, { duration: 0 });
      const fastestTest = performanceMetrics.reduce((min, m) => m.duration < min.duration ? m : min, { duration: Infinity });
      
      console.log('\n📊 MCP JavaScript Integration Performance Summary:');
      console.log(`   Total tests: ${totalTests}`);
      console.log(`   Total duration: ${totalDuration.toFixed(2)}ms`);
      console.log(`   Average duration: ${averageDuration.toFixed(2)}ms`);
      console.log(`   Fastest test: ${fastestTest.testName} (${fastestTest.duration.toFixed(2)}ms)`);
      console.log(`   Slowest test: ${slowestTest.testName} (${slowestTest.duration.toFixed(2)}ms)`);
      
      // Performance assertions
      expect(averageDuration).toBeLessThan(1000); // Average test should be under 1 second
      expect(slowestTest.duration).toBeLessThan(10000); // Slowest test should be under 10 seconds
      expect(fastestTest.duration).toBeGreaterThan(0); // All tests should take some time
      
      const duration = measurePerformance('Performance Summary', startTime);
      expect(duration).toBeLessThan(100);
    });
  });
});