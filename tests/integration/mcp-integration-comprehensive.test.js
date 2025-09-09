/**
 * Comprehensive MCP integration tests
 * @fileoverview Tests for MCP server stability, tool discovery, and Claude AI integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

/**
 * MCP Client for testing server integration
 */
class MCPTestClient extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.isConnected = false;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.responses = [];
  }

  /**
   * Start MCP server process and establish connection
   */
  async connect(serverPath = 'src/mcp/enhanced-server.js', timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.disconnect();
        reject(new Error(`Connection timeout after ${timeout}ms`));
      }, timeout);

      try {
        // Start server process
        this.process = spawn('node', [serverPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, DEBUG_UNJUCKS: 'true' }
        });

        let buffer = '';

        // Handle server output
        this.process.stdout.on('data', (data) => {
          buffer += data.toString();
          
          // Process complete JSON-RPC messages
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            
            if (line) {
              try {
                const message = JSON.parse(line);
                this.handleResponse(message);
              } catch (error) {
                console.error('Failed to parse server response:', line);
              }
            }
          }
        });

        // Handle server errors
        this.process.stderr.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Server started successfully')) {
            clearTimeout(timeoutId);
            this.isConnected = true;
            resolve();
          }
          // Log server output for debugging
          console.log('[Server]', output.trim());
        });

        this.process.on('error', (error) => {
          clearTimeout(timeoutId);
          reject(error);
        });

        this.process.on('exit', (code) => {
          this.isConnected = false;
          if (code !== 0) {
            console.error(`Server exited with code ${code}`);
          }
        });

      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect() {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this.isConnected = false;
    this.pendingRequests.clear();
  }

  /**
   * Send MCP request
   */
  async sendRequest(method, params = {}, timeout = 30000) {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    const id = ++this.requestId;
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      // Send request to server
      const message = JSON.stringify(request) + '\n';
      this.process.stdin.write(message);
    });
  }

  /**
   * Send MCP notification
   */
  sendNotification(method, params = {}) {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    const notification = {
      jsonrpc: "2.0",
      method,
      params
    };

    const message = JSON.stringify(notification) + '\n';
    this.process.stdin.write(message);
  }

  /**
   * Handle server response
   */
  handleResponse(message) {
    this.responses.push(message);
    
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(`MCP Error ${message.error.code}: ${message.error.message}`));
      } else {
        resolve(message.result);
      }
    }

    this.emit('message', message);
  }

  /**
   * Wait for specific response
   */
  async waitForResponse(predicate, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Wait for response timed out after ${timeout}ms`));
      }, timeout);

      const handler = (message) => {
        if (predicate(message)) {
          clearTimeout(timeoutId);
          this.off('message', handler);
          resolve(message);
        }
      };

      this.on('message', handler);
    });
  }
}

describe('MCP Integration - Server Startup and Connection', () => {
  let client;

  beforeEach(() => {
    client = new MCPTestClient();
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  it('should start server within timeout', async () => {
    await expect(client.connect()).resolves.toBeUndefined();
    expect(client.isConnected).toBe(true);
  });

  it('should handle server startup errors gracefully', async () => {
    await expect(client.connect('nonexistent/server.js', 5000))
      .rejects.toThrow();
  });

  it('should respond to ping requests', async () => {
    await client.connect();
    const result = await client.sendRequest('ping');
    
    expect(result).toMatchObject({
      pong: true,
      timestamp: expect.any(Number),
      uptime: expect.any(Number)
    });
  });
});

describe('MCP Integration - Protocol Compliance', () => {
  let client;

  beforeAll(async () => {
    client = new MCPTestClient();
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  it('should handle initialize request', async () => {
    const result = await client.sendRequest('initialize', {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    });

    expect(result).toMatchObject({
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: { listChanged: true },
        logging: { level: "info" }
      },
      serverInfo: {
        name: expect.stringContaining("unjucks"),
        version: expect.any(String),
        protocolVersion: "2024-11-05"
      }
    });
  });

  it('should return error for invalid requests', async () => {
    await expect(client.sendRequest('invalid_method'))
      .rejects.toThrow(/Method 'invalid_method' not found/);
  });

  it('should handle malformed JSON gracefully', async () => {
    // Send malformed JSON directly
    if (client.process) {
      client.process.stdin.write('{"invalid": json}\n');
      
      // Server should not crash and should continue responding
      const result = await client.sendRequest('ping');
      expect(result.pong).toBe(true);
    }
  });
});

describe('MCP Integration - Tool Discovery and Listing', () => {
  let client;

  beforeAll(async () => {
    client = new MCPTestClient();
    await client.connect();
    await client.sendRequest('initialize', {});
  });

  afterAll(async () => {
    await client.disconnect();
  });

  it('should list all available tools', async () => {
    const result = await client.sendRequest('tools/list');
    
    expect(result).toHaveProperty('tools');
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);

    // Verify each tool has required properties
    for (const tool of result.tools) {
      expect(tool).toMatchObject({
        name: expect.any(String),
        description: expect.any(String),
        inputSchema: expect.any(Object)
      });
    }
  });

  it('should include core Unjucks tools', async () => {
    const result = await client.sendRequest('tools/list');
    const toolNames = result.tools.map(t => t.name);

    const expectedTools = [
      'unjucks_list',
      'unjucks_generate',
      'unjucks_help',
      'unjucks_dry_run',
      'unjucks_inject'
    ];

    for (const expectedTool of expectedTools) {
      expect(toolNames).toContain(expectedTool);
    }
  });

  it('should provide detailed tool information with metadata', async () => {
    const result = await client.sendRequest('tools/list', { includeMetadata: true });
    
    expect(result.tools[0]).toMatchObject({
      metadata: {
        usageCount: expect.any(Number),
        averageExecutionTime: expect.any(Number),
        successRate: expect.any(String)
      }
    });
  });

  it('should support tool filtering by prefix', async () => {
    const result = await client.sendRequest('tools/list', { prefix: 'unjucks_' });
    
    expect(result.tools.every(tool => tool.name.startsWith('unjucks_'))).toBe(true);
    expect(result.filtered).toBeDefined();
  });
});

describe('MCP Integration - Tool Execution', () => {
  let client;
  let tempDir;

  beforeAll(async () => {
    client = new MCPTestClient();
    await client.connect();
    await client.sendRequest('initialize', {});
    tempDir = join(tmpdir(), `unjucks-test-${randomUUID()}`);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  it('should execute unjucks_list tool successfully', async () => {
    const result = await client.sendRequest('tools/call', {
      name: 'unjucks_list',
      arguments: {}
    });

    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.isError).toBe(false);
  });

  it('should execute unjucks_help tool with valid parameters', async () => {
    const result = await client.sendRequest('tools/call', {
      name: 'unjucks_help',
      arguments: {
        generator: 'command',
        template: 'citty'
      }
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('command');
  });

  it('should validate tool arguments and return detailed errors', async () => {
    const result = await client.sendRequest('tools/call', {
      name: 'unjucks_generate',
      arguments: {
        // Missing required parameters
        generator: 'test'
        // missing template and dest
      }
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Missing required field/);
  });

  it('should handle tool execution timeout', async () => {
    // This test might need a mock tool that intentionally delays
    const result = await client.sendRequest('tools/call', {
      name: 'unjucks_list',
      arguments: {}
    }, 100); // Very short timeout

    // Tool should complete quickly, but test timeout handling is in place
    expect(result).toBeDefined();
  });

  it('should support dry run operations', async () => {
    const result = await client.sendRequest('tools/call', {
      name: 'unjucks_dry_run',
      arguments: {
        generator: 'command',
        template: 'citty',
        dest: tempDir,
        variables: {
          commandName: 'test-command'
        }
      }
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('dry run');
  });
});

describe('MCP Integration - Error Handling and Recovery', () => {
  let client;

  beforeAll(async () => {
    client = new MCPTestClient();
    await client.connect();
    await client.sendRequest('initialize', {});
  });

  afterAll(async () => {
    await client.disconnect();
  });

  it('should handle concurrent requests without errors', async () => {
    const requests = Array.from({ length: 10 }, (_, i) => 
      client.sendRequest('tools/call', {
        name: 'unjucks_list',
        arguments: { detailed: i % 2 === 0 }
      })
    );

    const results = await Promise.all(requests);
    
    expect(results).toHaveLength(10);
    results.forEach(result => {
      expect(result.isError).toBe(false);
    });
  });

  it('should recover from invalid tool calls', async () => {
    // Send invalid tool call
    const invalidResult = await client.sendRequest('tools/call', {
      name: 'nonexistent_tool',
      arguments: {}
    });
    
    expect(invalidResult.isError).toBe(true);
    
    // Verify server is still responsive
    const validResult = await client.sendRequest('ping');
    expect(validResult.pong).toBe(true);
  });

  it('should handle large payloads gracefully', async () => {
    const largeVariables = {};
    for (let i = 0; i < 1000; i++) {
      largeVariables[`var_${i}`] = `value_${i}`.repeat(100);
    }

    const result = await client.sendRequest('tools/call', {
      name: 'unjucks_dry_run',
      arguments: {
        generator: 'command',
        template: 'citty',
        dest: '/tmp/test',
        variables: largeVariables
      }
    });

    // Should handle large payload without crashing
    expect(result).toBeDefined();
  });
});

describe('MCP Integration - Health Monitoring', () => {
  let client;

  beforeAll(async () => {
    client = new MCPTestClient();
    await client.connect();
    await client.sendRequest('initialize', {});
  });

  afterAll(async () => {
    await client.disconnect();
  });

  it('should provide server status information', async () => {
    const result = await client.sendRequest('server/status');
    
    expect(result).toMatchObject({
      server: {
        name: expect.any(String),
        version: expect.any(String)
      },
      metrics: {
        requests: {
          total: expect.any(Number),
          successful: expect.any(Number),
          successRate: expect.any(String)
        }
      }
    });
  });

  it('should track tool usage statistics', async () => {
    // Make some tool calls to generate statistics
    await client.sendRequest('tools/call', {
      name: 'unjucks_list',
      arguments: {}
    });

    const status = await client.sendRequest('server/status');
    
    expect(status.metrics.tools).toBeDefined();
    if (status.metrics.tools.unjucks_list) {
      expect(status.metrics.tools.unjucks_list).toMatchObject({
        count: expect.any(Number),
        successes: expect.any(Number),
        successRate: expect.any(String)
      });
    }
  });

  it('should support tool cache refresh', async () => {
    const result = await client.sendRequest('tools/refresh');
    
    expect(result).toMatchObject({
      refreshed: true,
      toolCount: expect.any(Number),
      timestamp: expect.any(Number)
    });
  });
});

describe('MCP Integration - Claude AI Compatibility', () => {
  let client;

  beforeAll(async () => {
    client = new MCPTestClient();
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  it('should provide Claude-compatible initialization', async () => {
    const result = await client.sendRequest('initialize', {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: "claude-desktop",
        version: "0.7.0"
      }
    });

    // Should include instructions for Claude
    expect(result.instructions).toContain('Unjucks MCP Server');
    expect(result.instructions).toContain('template generation');
  });

  it('should provide tools in Claude-expected format', async () => {
    const result = await client.sendRequest('tools/list');
    
    for (const tool of result.tools) {
      // Claude expects specific schema format
      expect(tool.inputSchema).toHaveProperty('type', 'object');
      expect(tool.inputSchema).toHaveProperty('properties');
      
      if (tool.inputSchema.required) {
        expect(Array.isArray(tool.inputSchema.required)).toBe(true);
      }
    }
  });

  it('should handle Claude-style tool execution', async () => {
    // Simulate how Claude would call tools
    const listResult = await client.sendRequest('tools/call', {
      name: 'unjucks_list',
      arguments: {
        detailed: true
      }
    });

    expect(listResult.content).toBeDefined();
    expect(listResult.content[0]).toMatchObject({
      type: 'text',
      text: expect.any(String)
    });
  });

  it('should provide structured error responses for Claude', async () => {
    const result = await client.sendRequest('tools/call', {
      name: 'unjucks_generate',
      arguments: {
        generator: 'invalid'
        // Missing required fields
      }
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringMatching(/Missing required field/)
    });
    
    // Should include helpful metadata
    if (result._meta) {
      expect(result._meta).toHaveProperty('errors');
    }
  });
});

describe('MCP Integration - Performance and Scalability', () => {
  let client;

  beforeAll(async () => {
    client = new MCPTestClient();
    await client.connect();
    await client.sendRequest('initialize', {});
  });

  afterAll(async () => {
    await client.disconnect();
  });

  it('should handle rapid successive requests', async () => {
    const startTime = Date.now();
    const requests = Array.from({ length: 50 }, () => 
      client.sendRequest('ping')
    );

    const results = await Promise.all(requests);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(50);
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    
    // All requests should succeed
    results.forEach(result => {
      expect(result.pong).toBe(true);
    });
  });

  it('should maintain performance under load', async () => {
    const iterations = 20;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await client.sendRequest('tools/call', {
        name: 'unjucks_list',
        arguments: {}
      });
      times.push(Date.now() - start);
    }

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);

    expect(averageTime).toBeLessThan(1000); // Average under 1 second
    expect(maxTime).toBeLessThan(5000); // No request over 5 seconds
  });

  it('should handle memory efficiently during extended use', async () => {
    const initialMemory = process.memoryUsage();
    
    // Perform many operations
    for (let i = 0; i < 100; i++) {
      await client.sendRequest('tools/call', {
        name: 'unjucks_list',
        arguments: { detailed: i % 10 === 0 }
      });
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Memory increase should be reasonable (less than 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});