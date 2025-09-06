import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPFactory } from '../factories/index.js';
import { createServer } from '../../src/mcp/server.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { JSONRPCRequest, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js';

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/server/index.js');

describe('MCP Integration Tests', () => {
  let server: Server;
  let mockTransport: any;

  beforeEach(() => {
    mockTransport = {
      onmessage: vi.fn(),
      postMessage: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    };

    server = createServer();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('server initialization', () => {
    it('should initialize MCP server successfully', () => {
      expect(server).toBeDefined();
    });

    it('should register all unjucks tools', async () => {
      const tools = await server.listTools();

      expect(tools.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'unjucks_list' }),
          expect.objectContaining({ name: 'unjucks_generate' }),
          expect.objectContaining({ name: 'unjucks_help' }),
          expect.objectContaining({ name: 'unjucks_dry_run' }),
          expect.objectContaining({ name: 'unjucks_inject' })
        ])
      );
    });

    it('should register server info', async () => {
      const info = await server.getServerInfo();

      expect(info.name).toBe('unjucks');
      expect(info.version).toBeDefined();
    });
  });

  describe('unjucks_list tool', () => {
    it('should list generators successfully', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_list',
          arguments: {}
        }
      });

      const response = await server.request(request);

      expect(response.result).toHaveProperty('content');
      expect(response.result.content[0]).toHaveProperty('type', 'text');
      expect(response.result.content[0].text).toContain('generators');
    });

    it('should handle custom templates directory', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_list',
          arguments: {
            templatesDir: '/custom/templates'
          }
        }
      });

      const response = await server.request(request);

      expect(response.result).toHaveProperty('content');
    });

    it('should handle empty templates directory', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_list',
          arguments: {
            templatesDir: '/nonexistent'
          }
        }
      });

      const response = await server.request(request);

      expect(response.result.content[0].text).toContain('No generators found');
    });
  });

  describe('unjucks_generate tool', () => {
    it('should generate files successfully', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'component',
            template: 'basic',
            dest: './src',
            variables: {
              name: 'TestComponent'
            }
          }
        }
      });

      const response = await server.request(request);

      expect(response.result).toHaveProperty('content');
      expect(response.result.content[0].text).toContain('Generated');
    });

    it('should handle dry run', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'component',
            template: 'basic',
            dry: true,
            variables: {
              name: 'TestComponent'
            }
          }
        }
      });

      const response = await server.request(request);

      expect(response.result.content[0].text).toContain('DRY RUN');
      expect(response.result.content[0].text).toContain('Would create');
    });

    it('should handle force overwrite', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'component',
            template: 'basic',
            force: true,
            variables: {
              name: 'TestComponent'
            }
          }
        }
      });

      const response = await server.request(request);

      expect(response.result).toHaveProperty('content');
    });

    it('should handle missing required parameters', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            // Missing generator and template
            variables: {
              name: 'TestComponent'
            }
          }
        }
      });

      const response = await server.request(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });
  });

  describe('unjucks_help tool', () => {
    it('should show generator help', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_help',
          arguments: {
            generator: 'component',
            template: 'basic'
          }
        }
      });

      const response = await server.request(request);

      expect(response.result.content[0].text).toContain('component');
      expect(response.result.content[0].text).toContain('Variables');
    });

    it('should show general help when no parameters provided', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_help',
          arguments: {}
        }
      });

      const response = await server.request(request);

      expect(response.result.content[0].text).toContain('Unjucks');
      expect(response.result.content[0].text).toContain('Commands');
    });
  });

  describe('unjucks_dry_run tool', () => {
    it('should perform dry run successfully', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_dry_run',
          arguments: {
            generator: 'component',
            template: 'basic',
            variables: {
              name: 'TestComponent'
            }
          }
        }
      });

      const response = await server.request(request);

      expect(response.result.content[0].text).toContain('DRY RUN');
      expect(response.result.content[0].text).toContain('Would create');
    });

    it('should show file paths and sizes', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_dry_run',
          arguments: {
            generator: 'component',
            template: 'basic',
            dest: './custom',
            variables: {
              name: 'CustomComponent'
            }
          }
        }
      });

      const response = await server.request(request);

      expect(response.result.content[0].text).toContain('./custom');
      expect(response.result.content[0].text).toContain('bytes');
    });
  });

  describe('unjucks_inject tool', () => {
    it('should inject content successfully', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_inject',
          arguments: {
            file: './src/index.ts',
            content: 'export const newFunction = () => {};',
            options: {
              after: 'export const existingFunction'
            }
          }
        }
      });

      const response = await server.request(request);

      expect(response.result.content[0].text).toContain('Injected');
    });

    it('should skip injection when condition is met', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_inject',
          arguments: {
            file: './src/index.ts',
            content: 'import { useState } from "react";',
            options: {
              after: 'import React',
              skipIf: 'useState'
            }
          }
        }
      });

      const response = await server.request(request);

      expect(response.result.content[0].text).toContain('Skipped');
    });

    it('should handle non-existent file', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_inject',
          arguments: {
            file: './nonexistent/file.ts',
            content: 'some content',
            options: {}
          }
        }
      });

      const response = await server.request(request);

      expect(response.error).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle invalid tool names', async () => {
      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'invalid_tool',
          arguments: {}
        }
      });

      const response = await server.request(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601); // Method not found
    });

    it('should handle malformed requests', async () => {
      const request = {
        id: 'test',
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          // Missing name parameter
          arguments: {}
        }
      };

      const response = await server.request(request as JSONRPCRequest);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602); // Invalid params
    });

    it('should handle internal errors gracefully', async () => {
      // Mock an internal error
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const request = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_generate',
          arguments: {
            generator: 'component',
            template: 'basic',
            variables: {
              // Circular reference to cause error
              circular: (() => {
                const obj: any = {};
                obj.self = obj;
                return obj;
              })()
            }
          }
        }
      });

      const response = await server.request(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32603); // Internal error
    });
  });

  describe('protocol compliance', () => {
    it('should handle batch requests', async () => {
      const batchRequests = [
        MCPFactory.createRequest({
          method: 'tools/list',
          id: 1
        }),
        MCPFactory.createRequest({
          method: 'tools/call',
          params: {
            name: 'unjucks_list',
            arguments: {}
          },
          id: 2
        })
      ];

      const responses = await Promise.all(
        batchRequests.map(req => server.request(req))
      );

      expect(responses).toHaveLength(2);
      expect(responses[0].id).toBe(1);
      expect(responses[1].id).toBe(2);
    });

    it('should handle requests without id (notifications)', async () => {
      const notification = MCPFactory.createRequest({
        method: 'tools/call',
        params: {
          name: 'unjucks_list',
          arguments: {}
        },
        id: undefined
      });

      // Notifications should not return a response
      const response = await server.request(notification);
      expect(response).toBeUndefined();
    });

    it('should validate JSON-RPC version', async () => {
      const invalidRequest = {
        method: 'tools/list',
        params: {},
        id: 'test',
        jsonrpc: '1.0' // Invalid version
      };

      const response = await server.request(invalidRequest as JSONRPCRequest);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600); // Invalid request
    });
  });

  describe('performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 20 }, (_, i) =>
        MCPFactory.createRequest({
          method: 'tools/call',
          params: {
            name: 'unjucks_list',
            arguments: {}
          },
          id: i
        })
      );

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(req => server.request(req))
      );
      const endTime = Date.now();

      expect(responses).toHaveLength(20);
      responses.forEach((response, i) => {
        expect(response.id).toBe(i);
        expect(response.result).toBeDefined();
      });
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });

    it('should handle large payloads efficiently', async () => {
      const largeVariables = MCPFactory.createPerformanceScenarios().largeVariables;

      const startTime = Date.now();
      const response = await server.request(largeVariables);
      const endTime = Date.now();

      expect(response.result || response.error).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should handle large payloads
    });
  });

  describe('factory integration', () => {
    it('should handle factory-generated scenarios', async () => {
      const scenarios = MCPFactory.createProtocolScenarios();

      // Test valid request
      const response = await server.request(scenarios.validRequest);
      expect(response.result).toBeDefined();

      // Test error scenarios
      const errorResponse = await server.request(scenarios.invalidMethod);
      expect(errorResponse.error).toBeDefined();
    });

    it('should handle batch scenarios from factory', async () => {
      const batchScenarios = MCPFactory.createBatchScenarios();

      for (const [scenarioName, requests] of Object.entries(batchScenarios)) {
        const responses = await Promise.all(
          (requests as any[]).map(req => server.request(req))
        );

        expect(responses).toHaveLength(requests.length);

        if (scenarioName === 'multipleMethods') {
          // All should succeed
          responses.forEach(response => {
            expect(response.result || response.error).toBeDefined();
          });
        } else if (scenarioName === 'allInvalid') {
          // All should fail
          responses.forEach(response => {
            expect(response.error).toBeDefined();
          });
        }
      }
    });
  });
});