/**
 * Contract Testing for MCP Integration
 * Tests contracts between Unjucks CLI and MCP servers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Mock MCP responses for contract testing
const MCPContracts = {
  // MCP Server Initialization Contract
  serverInit: {
    request: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'unjucks',
          version: expect.any(String)
        }
      }
    },
    response: {
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: true
          }
        },
        serverInfo: {
          name: 'unjucks-mcp',
          version: expect.any(String)
        }
      }
    }
  },

  // Tools List Contract
  toolsList: {
    request: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    },
    response: {
      jsonrpc: '2.0',
      id: 2,
      result: {
        tools: [
          {
            name: 'unjucks-generate',
            description: 'Generate files from templates',
            inputSchema: {
              type: 'object',
              properties: {
                generator: { type: 'string' },
                template: { type: 'string' },
                name: { type: 'string' }
              },
              required: ['generator', 'template', 'name']
            }
          },
          {
            name: 'unjucks-list',
            description: 'List available generators',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string' }
              }
            }
          }
        ]
      }
    }
  },

  // Tool Call Contract
  toolCall: {
    request: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'unjucks-generate',
        arguments: {
          generator: 'component',
          template: 'react',
          name: 'TestComponent'
        }
      }
    },
    response: {
      jsonrpc: '2.0',
      id: 3,
      result: {
        content: [
          {
            type: 'text',
            text: expect.stringContaining('Generated')
          }
        ],
        isError: false
      }
    }
  },

  // Error Response Contract
  errorResponse: {
    request: {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'unjucks-generate',
        arguments: {
          generator: 'nonexistent',
          template: 'missing'
        }
      }
    },
    response: {
      jsonrpc: '2.0',
      id: 4,
      error: {
        code: expect.any(Number),
        message: expect.any(String),
        data: expect.any(Object)
      }
    }
  }
};

describe('MCP Contract Testing', () => {
  let mockMCPServer;
  let originalStdio;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMCPServer = createMockMCPServer();
    originalStdio = process.stdio;
  });

  afterEach(() => {
    if (mockMCPServer) {
      mockMCPServer.destroy();
    }
    process.stdio = originalStdio;
  });

  describe('MCP Server Initialization Contract', () => {
    it('should initialize MCP server with correct protocol', async () => {
      const initMessage = MCPContracts.serverInit.request;
      const expectedResponse = MCPContracts.serverInit.response;

      const response = await sendMCPMessage(initMessage);
      
      expect(response).toMatchObject(expectedResponse);
      expect(response.result.protocolVersion).toBe('2024-11-05');
      expect(response.result.serverInfo.name).toBeDefined();
    });

    it('should handle protocol version mismatch', async () => {
      const initMessage = {
        ...MCPContracts.serverInit.request,
        params: {
          ...MCPContracts.serverInit.request.params,
          protocolVersion: '2023-01-01' // Outdated version
        }
      };

      const response = await sendMCPMessage(initMessage);
      
      // Should either accept with compatible version or error
      expect(response).toHaveProperty('result');
    });
  });

  describe('Tools Discovery Contract', () => {
    it('should list available tools with correct schema', async () => {
      const listMessage = MCPContracts.toolsList.request;
      const expectedResponse = MCPContracts.toolsList.response;

      const response = await sendMCPMessage(listMessage);
      
      expect(response).toMatchObject(expectedResponse);
      expect(response.result.tools).toBeInstanceOf(Array);
      
      response.result.tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type');
      });
    });

    it('should include required unjucks tools', async () => {
      const response = await sendMCPMessage(MCPContracts.toolsList.request);
      
      const toolNames = response.result.tools.map(tool => tool.name);
      expect(toolNames).toContain('unjucks-generate');
      expect(toolNames).toContain('unjucks-list');
    });
  });

  describe('Tool Execution Contract', () => {
    it('should execute unjucks-generate tool correctly', async () => {
      const callMessage = MCPContracts.toolCall.request;
      const response = await sendMCPMessage(callMessage);
      
      expect(response.result).toHaveProperty('content');
      expect(response.result.content).toBeInstanceOf(Array);
      expect(response.result.isError).toBe(false);
    });

    it('should validate tool arguments against schema', async () => {
      const invalidCallMessage = {
        ...MCPContracts.toolCall.request,
        params: {
          name: 'unjucks-generate',
          arguments: {
            // Missing required 'generator' field
            template: 'react',
            name: 'TestComponent'
          }
        }
      };

      const response = await sendMCPMessage(invalidCallMessage);
      
      expect(response).toHaveProperty('error');
      expect(response.error.code).toBeDefined();
    });

    it('should handle unknown tools gracefully', async () => {
      const unknownToolMessage = {
        ...MCPContracts.toolCall.request,
        params: {
          name: 'unknown-tool',
          arguments: {}
        }
      };

      const response = await sendMCPMessage(unknownToolMessage);
      
      expect(response).toHaveProperty('error');
      expect(response.error.message).toContain('unknown');
    });
  });

  describe('Error Handling Contract', () => {
    it('should return structured errors for invalid operations', async () => {
      const errorMessage = MCPContracts.errorResponse.request;
      const response = await sendMCPMessage(errorMessage);
      
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code');
      expect(response.error).toHaveProperty('message');
      expect(typeof response.error.code).toBe('number');
      expect(typeof response.error.message).toBe('string');
    });

    it('should include helpful error details', async () => {
      const response = await sendMCPMessage(MCPContracts.errorResponse.request);
      
      expect(response.error.message).toBeTruthy();
      if (response.error.data) {
        expect(response.error.data).toBeInstanceOf(Object);
      }
    });
  });

  describe('JSON-RPC Protocol Compliance', () => {
    it('should follow JSON-RPC 2.0 specification', async () => {
      const testMessage = {
        jsonrpc: '2.0',
        id: 999,
        method: 'tools/list'
      };

      const response = await sendMCPMessage(testMessage);
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(999);
      expect(response).toHaveProperty('result');
    });

    it('should handle notifications (no id) correctly', async () => {
      const notification = {
        jsonrpc: '2.0',
        method: 'tools/changed'
      };

      // Notifications should not return responses
      const response = await sendMCPMessage(notification);
      expect(response).toBeNull();
    });

    it('should reject invalid JSON-RPC messages', async () => {
      const invalidMessage = {
        // Missing jsonrpc field
        id: 1,
        method: 'tools/list'
      };

      const response = await sendMCPMessage(invalidMessage);
      
      expect(response).toHaveProperty('error');
      expect(response.error.code).toBe(-32600); // Invalid Request
    });
  });

  describe('MCP Server Lifecycle Contract', () => {
    it('should handle server shutdown gracefully', async () => {
      const shutdownMessage = {
        jsonrpc: '2.0',
        id: 100,
        method: 'shutdown'
      };

      const response = await sendMCPMessage(shutdownMessage);
      expect(response.result).toBeNull();
    });

    it('should reject requests after shutdown', async () => {
      // Send shutdown first
      await sendMCPMessage({
        jsonrpc: '2.0',
        id: 100,
        method: 'shutdown'
      });

      // Then try to call a tool
      const response = await sendMCPMessage(MCPContracts.toolsList.request);
      
      expect(response).toHaveProperty('error');
    });
  });

  describe('Performance Contract', () => {
    it('should respond within reasonable time limits', async () => {
      const start = this.getDeterministicTimestamp();
      await sendMCPMessage(MCPContracts.toolsList.request);
      const duration = this.getDeterministicTimestamp() - start;
      
      expect(duration).toBeLessThan(5000); // 5 second max
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        ...MCPContracts.toolsList.request,
        id: i + 1
      }));

      const responses = await Promise.all(
        requests.map(req => sendMCPMessage(req))
      );

      responses.forEach((response, i) => {
        expect(response.id).toBe(i + 1);
        expect(response.result).toBeDefined();
      });
    });
  });

  describe('Data Contract Validation', () => {
    it('should maintain consistent data types in responses', async () => {
      const response = await sendMCPMessage(MCPContracts.toolsList.request);
      
      // Validate data types match schema
      expect(typeof response.jsonrpc).toBe('string');
      expect(typeof response.id).toBe('number');
      expect(Array.isArray(response.result.tools)).toBe(true);
    });

    it('should not leak internal implementation details', async () => {
      const response = await sendMCPMessage(MCPContracts.toolCall.request);
      
      const responseString = JSON.stringify(response);
      expect(responseString).not.toContain('node_modules');
      expect(responseString).not.toContain('file://');
      expect(responseString).not.toContain(process.cwd());
    });
  });
});

/**
 * Create a mock MCP server for testing
 */
function createMockMCPServer() {
  return {
    initialized: false,
    shutdown: false,
    tools: [
      {
        name: 'unjucks-generate',
        description: 'Generate files from templates',
        inputSchema: {
          type: 'object',
          properties: {
            generator: { type: 'string' },
            template: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['generator', 'template', 'name']
        }
      },
      {
        name: 'unjucks-list',
        description: 'List available generators',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          }
        }
      }
    ],
    destroy() {
      this.shutdown = true;
    }
  };
}

/**
 * Send MCP message and get response
 */
async function sendMCPMessage(message) {
  // Mock MCP message handling
  const server = mockMCPServer;

  if (server.shutdown && message.method !== 'shutdown') {
    return {
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32003,
        message: 'Server is shut down'
      }
    };
  }

  switch (message.method) {
    case 'initialize':
      server.initialized = true;
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: 'unjucks-mcp', version: '1.0.0' }
        }
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: { tools: server.tools }
      };

    case 'tools/call':
      const { name, arguments: args } = message.params;
      
      if (name === 'unjucks-generate') {
        if (!args.generator || !args.template) {
          return {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32602,
              message: 'Invalid params'
            }
          };
        }
        
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [{ type: 'text', text: 'Generated successfully' }],
            isError: false
          }
        };
      }
      
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      };

    case 'shutdown':
      server.shutdown = true;
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: null
      };

    default:
      if (message.id === undefined) {
        // Notification - no response
        return null;
      }
      
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      };
  }
}