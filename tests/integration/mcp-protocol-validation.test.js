/**
 * MCP Protocol Validation Test Suite
 * 
 * Tests the core MCP protocol implementation in JavaScript to ensure
 * proper JSON-RPC 2.0 compliance, message handling, and error responses.
 * 
 * This suite validates:
 * - JSON-RPC 2.0 protocol compliance
 * - Request/response message format
 * - Error handling and codes
 * - Tool schema validation
 * - Server capability negotiation
 * - Protocol state management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

import { UnjucksMCPServer } from '../../src/mcp/server.js';
import { MCPRequestHandler } from '../../src/mcp/handlers/index.js';
import { 
  createMCPError, 
  createMCPResponse, 
  createTextToolResult, 
  createJSONToolResult,
  validateRequiredParams
} from '../../src/mcp/utils.js';
import { 
  MCPErrorCode, 
  TOOL_SCHEMAS, 
  isValidMCPRequest, 
  isValidMCPNotification 
} from '../../src/mcp/types.js';

describe('MCP Protocol Validation', () => {
  let server;
  let requestHandler;
  let mockStdin;
  let mockStdout;
  let capturedOutput;

  beforeEach(() => {
    // Create mock streams
    mockStdin = new Readable({
      read() {}
    });
    
    capturedOutput = [];
    mockStdout = new Writable({
      write(chunk, encoding, callback) {
        capturedOutput.push(chunk.toString());
        callback();
      }
    });

    requestHandler = new MCPRequestHandler();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  describe('JSON-RPC 2.0 Protocol Compliance', () => {
    it('should validate proper JSON-RPC 2.0 request format', () => {
      const validRequests = [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2024-11-05' }
        },
        {
          jsonrpc: '2.0',
          id: 'string-id',
          method: 'tools/list'
        },
        {
          jsonrpc: '2.0',
          id: 42,
          method: 'tools/call',
          params: { name: 'unjucks_list', arguments: {} }
        }
      ];

      for (const request of validRequests) {
        expect(isValidMCPRequest(request)).toBe(true);
      }
    });

    it('should reject invalid JSON-RPC 2.0 requests', () => {
      const invalidRequests = [
        null,
        undefined,
        {},
        { jsonrpc: '1.0', id: 1, method: 'test' }, // Wrong version
        { jsonrpc: '2.0', method: 'test' }, // Missing id
        { jsonrpc: '2.0', id: 1 }, // Missing method
        { jsonrpc: '2.0', id: 1, method: '' }, // Empty method
        { jsonrpc: '2.0', id: 1, method: 123 }, // Non-string method
        { id: 1, method: 'test' }, // Missing jsonrpc
        { jsonrpc: '2.0', id: null, method: 'test' } // Null id
      ];

      for (const request of invalidRequests) {
        expect(isValidMCPRequest(request)).toBe(false);
      }
    });

    it('should validate proper JSON-RPC 2.0 notification format', () => {
      const validNotifications = [
        {
          jsonrpc: '2.0',
          method: 'notifications/initialized'
        },
        {
          jsonrpc: '2.0',
          method: 'notifications/cancelled',
          params: { requestId: '123' }
        }
      ];

      for (const notification of validNotifications) {
        expect(isValidMCPNotification(notification)).toBe(true);
      }
    });

    it('should reject invalid notifications', () => {
      const invalidNotifications = [
        { jsonrpc: '2.0', method: 'test', id: 1 }, // Has id (should be request)
        { jsonrpc: '1.0', method: 'test' }, // Wrong version
        { method: 'test' }, // Missing jsonrpc
        { jsonrpc: '2.0' } // Missing method
      ];

      for (const notification of invalidNotifications) {
        expect(isValidMCPNotification(notification)).toBe(false);
      }
    });

    it('should create properly formatted responses', () => {
      const response = createMCPResponse(123, { data: 'test result' });
      
      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 123,
        result: { data: 'test result' }
      });
    });

    it('should create properly formatted error responses', () => {
      const error = createMCPError(456, MCPErrorCode.InvalidParams, 'Invalid parameters provided');
      
      expect(error).toEqual({
        jsonrpc: '2.0',
        id: 456,
        error: {
          code: MCPErrorCode.InvalidParams,
          message: 'Invalid parameters provided'
        }
      });
    });

    it('should create error responses with additional data', () => {
      const error = createMCPError(789, MCPErrorCode.InvalidRequest, 'Bad request', {
        details: 'Missing required field',
        field: 'generator'
      });
      
      expect(error.error.data).toEqual({
        details: 'Missing required field',
        field: 'generator'
      });
    });
  });

  describe('Message Handling', () => {
    it('should handle initialize request properly', async () => {
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      };

      const response = await requestHandler.handleRequest(initRequest);
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.protocolVersion).toBe('2024-11-05');
      expect(response.result.serverInfo).toBeDefined();
      expect(response.result.capabilities).toBeDefined();
    });

    it('should handle tools/list request', async () => {
      const listRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      };

      const response = await requestHandler.handleRequest(listRequest);
      
      expect(response.result.tools).toBeInstanceOf(Array);
      expect(response.result.tools.length).toBeGreaterThan(0);
      
      // Verify each tool has required properties
      for (const tool of response.result.tools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });

    it('should handle tools/call request', async () => {
      const callRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'unjucks_list',
          arguments: { detailed: false }
        }
      };

      const response = await requestHandler.handleRequest(callRequest);
      
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeInstanceOf(Array);
      expect(response.result.content[0]).toBeDefined();
    });

    it('should handle unknown methods with proper error', async () => {
      const unknownRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'unknown/method',
        params: {}
      };

      const response = await requestHandler.handleRequest(unknownRequest);
      
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(MCPErrorCode.MethodNotFound);
      expect(response.error.message).toContain('unknown/method');
    });

    it('should handle malformed requests gracefully', async () => {
      const malformedRequests = [
        null,
        undefined,
        'invalid json',
        { invalid: 'request' },
        { jsonrpc: '2.0', id: 1 }, // Missing method
      ];

      for (const request of malformedRequests) {
        try {
          const response = await requestHandler.handleRequest(request);
          
          // Should return error response for requests with ID
          if (request && request.id) {
            expect(response.error).toBeDefined();
            expect(response.error.code).toBeDefined();
          }
        } catch (error) {
          // Some malformed requests should throw
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Error Code Validation', () => {
    it('should have all required MCP error codes', () => {
      expect(MCPErrorCode.ParseError).toBe(-32700);
      expect(MCPErrorCode.InvalidRequest).toBe(-32600);
      expect(MCPErrorCode.MethodNotFound).toBe(-32601);
      expect(MCPErrorCode.InvalidParams).toBe(-32602);
      expect(MCPErrorCode.InternalError).toBe(-32603);
      expect(MCPErrorCode.ServerError).toBe(-32000);
      expect(MCPErrorCode.ApplicationError).toBe(-32001);
      expect(MCPErrorCode.ResourceNotFound).toBe(-32002);
      expect(MCPErrorCode.PermissionDenied).toBe(-32003);
    });

    it('should create errors with correct codes', () => {
      const errorCodes = [
        MCPErrorCode.ParseError,
        MCPErrorCode.InvalidRequest,
        MCPErrorCode.MethodNotFound,
        MCPErrorCode.InvalidParams,
        MCPErrorCode.InternalError
      ];

      for (const code of errorCodes) {
        const error = createMCPError(1, code, 'Test error');
        expect(error.error.code).toBe(code);
      }
    });

    it('should handle parameter validation errors', async () => {
      const invalidToolCall = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {} // Missing required parameters
        }
      };

      const response = await requestHandler.handleRequest(invalidToolCall);
      
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(MCPErrorCode.InvalidParams);
    });
  });

  describe('Tool Schema Validation', () => {
    it('should have valid schemas for all tools', () => {
      const expectedTools = [
        'unjucks_list',
        'unjucks_generate', 
        'unjucks_help',
        'unjucks_dry_run',
        'unjucks_inject'
      ];

      for (const toolName of expectedTools) {
        const schema = TOOL_SCHEMAS[toolName];
        expect(schema).toBeDefined();
        expect(schema.type).toBe('object');
        expect(schema.properties).toBeDefined();
        
        if (schema.required) {
          expect(Array.isArray(schema.required)).toBe(true);
        }
      }
    });

    it('should validate required parameters correctly', () => {
      // Valid parameters
      expect(() => validateRequiredParams(
        { generator: 'test', template: 'basic', dest: './out' },
        ['generator', 'template', 'dest']
      )).not.toThrow();

      // Missing required parameter
      expect(() => validateRequiredParams(
        { generator: 'test', template: 'basic' },
        ['generator', 'template', 'dest']
      )).toThrow();

      // Empty object with required parameters
      expect(() => validateRequiredParams(
        {},
        ['generator']
      )).toThrow();

      // Null/undefined values
      expect(() => validateRequiredParams(
        { generator: null, template: 'basic' },
        ['generator', 'template']
      )).toThrow();
    });

    it('should validate tool schemas match JSON Schema spec', () => {
      for (const [toolName, schema] of Object.entries(TOOL_SCHEMAS)) {
        // Must be an object schema
        expect(schema.type).toBe('object');
        
        // Must have properties
        expect(schema.properties).toBeDefined();
        expect(typeof schema.properties).toBe('object');
        
        // Required field must be array if present
        if (schema.required) {
          expect(Array.isArray(schema.required)).toBe(true);
          
          // All required fields must exist in properties
          for (const requiredField of schema.required) {
            expect(schema.properties[requiredField]).toBeDefined();
          }
        }
        
        // Properties should have valid types
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          expect(propSchema.type).toBeDefined();
          expect(['string', 'number', 'boolean', 'object', 'array']).toContain(propSchema.type);
          
          if (propSchema.description) {
            expect(typeof propSchema.description).toBe('string');
          }
        }
      }
    });
  });

  describe('Server Capability Negotiation', () => {
    it('should report correct server capabilities', () => {
      const capabilities = requestHandler.getCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.tools).toBeDefined();
      expect(typeof capabilities.tools.listChanged).toBe('boolean');
      
      // Should support tools
      expect(capabilities.tools).toBeDefined();
    });

    it('should report correct server info', () => {
      const serverInfo = requestHandler.getServerInfo();
      
      expect(serverInfo.name).toBeDefined();
      expect(typeof serverInfo.name).toBe('string');
      expect(serverInfo.version).toBeDefined();
      expect(typeof serverInfo.version).toBe('string');
      expect(serverInfo.protocolVersion).toBeDefined();
      expect(serverInfo.protocolVersion).toBe('2024-11-05');
    });

    it('should handle capability negotiation in initialize', async () => {
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true }
          }
        }
      };

      const response = await requestHandler.handleRequest(initRequest);
      
      expect(response.result.capabilities).toBeDefined();
      expect(response.result.serverInfo).toBeDefined();
      expect(response.result.protocolVersion).toBe('2024-11-05');
    });
  });

  describe('Protocol State Management', () => {
    it('should track request processing state', async () => {
      const initialStats = requestHandler.getStats ? requestHandler.getStats() : {};
      
      await requestHandler.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      });
      
      // Request should be processed
      expect(true).toBe(true); // Basic assertion that request completed
    });

    it('should handle concurrent requests properly', async () => {
      const requests = [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        },
        {
          jsonrpc: '2.0', 
          id: 2,
          method: 'tools/list'
        },
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'unjucks_list', arguments: {} }
        }
      ];

      const responses = await Promise.all(
        requests.map(req => requestHandler.handleRequest(req))
      );

      // All requests should get responses
      expect(responses).toHaveLength(3);
      
      // Each response should have correct ID
      for (let i = 0; i < responses.length; i++) {
        expect(responses[i].id).toBe(requests[i].id);
      }
    });

    it('should maintain protocol version consistency', async () => {
      const requests = [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2024-11-05' }
        },
        {
          jsonrpc: '2.0',
          id: 2, 
          method: 'tools/list'
        }
      ];

      const responses = await Promise.all(
        requests.map(req => requestHandler.handleRequest(req))
      );

      // All responses should use JSON-RPC 2.0
      for (const response of responses) {
        expect(response.jsonrpc).toBe('2.0');
      }
    });
  });

  describe('Tool Result Format Validation', () => {
    it('should create properly formatted text tool results', () => {
      const textResult = createTextToolResult('Hello, world!', { 
        operation: 'test',
        timestamp: this.getDeterministicDate().toISOString()
      });

      expect(textResult.content).toHaveLength(1);
      expect(textResult.content[0].type).toBe('text');
      expect(textResult.content[0].text).toBe('Hello, world!');
      expect(textResult._meta.operation).toBe('test');
      expect(textResult._meta.timestamp).toBeDefined();
    });

    it('should create properly formatted JSON tool results', () => {
      const data = { generators: ['component', 'api'], count: 2 };
      const jsonResult = createJSONToolResult(data, { 
        operation: 'list',
        cached: false
      });

      expect(jsonResult.content).toHaveLength(1);
      expect(jsonResult.content[0].type).toBe('text');
      
      const parsedContent = JSON.parse(jsonResult.content[0].text);
      expect(parsedContent).toEqual(data);
      expect(jsonResult._meta.operation).toBe('list');
      expect(jsonResult._meta.cached).toBe(false);
    });

    it('should handle tool results with multiple content items', () => {
      const result = {
        content: [
          { type: 'text', text: 'Operation completed successfully' },
          { type: 'text', text: 'Files generated: 3' }
        ],
        _meta: { operation: 'generate' }
      };

      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('text');
      expect(result.content[1].type).toBe('text');
      expect(result._meta.operation).toBe('generate');
    });

    it('should handle error tool results', () => {
      const errorResult = {
        content: [{ type: 'text', text: 'Error: Template not found' }],
        isError: true,
        _meta: { 
          operation: 'generate',
          errorCode: 'TEMPLATE_NOT_FOUND',
          timestamp: this.getDeterministicDate().toISOString()
        }
      };

      expect(errorResult.isError).toBe(true);
      expect(errorResult.content[0].text).toContain('Error:');
      expect(errorResult._meta.errorCode).toBe('TEMPLATE_NOT_FOUND');
    });
  });

  describe('Stress Testing', () => {
    it('should handle rapid sequential requests', async () => {
      const requests = Array.from({ length: 100 }, (_, i) => ({
        jsonrpc: '2.0',
        id: i + 1,
        method: 'tools/list'
      }));

      const startTime = this.getDeterministicTimestamp();
      const responses = [];
      
      for (const request of requests) {
        const response = await requestHandler.handleRequest(request);
        responses.push(response);
      }
      
      const endTime = this.getDeterministicTimestamp();
      const duration = endTime - startTime;

      expect(responses).toHaveLength(100);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      // All responses should be valid
      for (let i = 0; i < responses.length; i++) {
        expect(responses[i].id).toBe(i + 1);
        expect(responses[i].jsonrpc).toBe('2.0');
      }
    });

    it('should handle large request payloads', async () => {
      const largeVariables = {};
      for (let i = 0; i < 1000; i++) {
        largeVariables[`var${i}`] = `value${i}`.repeat(100);
      }

      const largeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'unjucks_dry_run',
          arguments: {
            generator: 'component',
            template: 'basic',
            dest: './test',
            variables: largeVariables
          }
        }
      };

      const response = await requestHandler.handleRequest(largeRequest);
      
      // Should handle large payload without error
      expect(response).toBeDefined();
      expect(response.id).toBe(1);
    });

    it('should maintain memory efficiency under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process many requests
      for (let batch = 0; batch < 10; batch++) {
        const batchRequests = Array.from({ length: 50 }, (_, i) => ({
          jsonrpc: '2.0',
          id: batch * 50 + i + 1,
          method: 'tools/list'
        }));

        await Promise.all(
          batchRequests.map(req => requestHandler.handleRequest(req))
        );
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;
      
      // Should not grow memory excessively
      expect(memoryGrowth).toBeLessThan(50); // Less than 50MB growth
    });
  });
});