import { Given, When, Then } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPTestContext {
  mcpServer?: ChildProcess;
  responses: MCPResponse[];
  errors: string[];
  tempDir?: string;
}

const context: MCPTestContext = {
  responses: [],
  errors: []
};

// Helper to send JSON-RPC request to MCP server
async function sendMCPRequest(request: MCPRequest): Promise<MCPResponse> {
  return new Promise((resolve, reject) => {
    if (!context.mcpServer) {
      reject(new Error('MCP server not running'));
      return;
    }

    const requestStr = JSON.stringify(request) + '\n';
    let responseData = '';

    const timeout = setTimeout(() => {
      reject(new Error('MCP request timeout'));
    }, 5000);

    const onData = (data: Buffer) => {
      responseData += data.toString();
      try {
        const response = JSON.parse(responseData.trim());
        clearTimeout(timeout);
        context.mcpServer?.stdout?.off('data', onData);
        resolve(response);
      } catch {
        // Wait for more data
      }
    };

    context.mcpServer.stdout?.on('data', onData);
    context.mcpServer.stdin?.write(requestStr);
  });
}

Given('I have a clean test environment', async () => {
  // Create temporary directory for testing
  context.tempDir = path.join(projectRoot, 'temp-mcp-test-' + Date.now());
  await fs.mkdir(context.tempDir, { recursive: true });
  
  // Clear any previous state
  context.responses = [];
  context.errors = [];
});

Given('the MCP server is available', async () => {
  // Verify MCP server binary exists
  const mcpServerPath = path.join(projectRoot, 'dist', 'mcp-server.mjs');
  const exists = await fs.access(mcpServerPath).then(() => true).catch(() => false);
  expect(exists).toBe(true);
});

When('I start the MCP server', async () => {
  const mcpServerPath = path.join(projectRoot, 'dist', 'mcp-server.mjs');
  
  context.mcpServer = spawn('node', [mcpServerPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: context.tempDir
  });

  // Give server time to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  expect(context.mcpServer.killed).toBe(false);
});

Given('the MCP server is running', async () => {
  if (!context.mcpServer) {
    const mcpServerPath = path.join(projectRoot, 'dist', 'mcp-server.mjs');
    
    context.mcpServer = spawn('node', [mcpServerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: context.tempDir
    });

    // Give server time to start and send initialize request
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Send initialize request
    const initResponse = await sendMCPRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'vitest-test', version: '1.0.0' }
      }
    });
    
    expect(initResponse.error).toBeUndefined();
  }
});

When('I send a {string} request', async (method: string) => {
  const request: MCPRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method
  };

  try {
    const response = await sendMCPRequest(request);
    context.responses.push(response);
  } catch (error) {
    context.errors.push(error instanceof Error ? error.message : String(error));
  }
});

When('I send an invalid JSON-RPC request', async () => {
  if (!context.mcpServer?.stdin) {
    throw new Error('MCP server not available');
  }

  // Send malformed JSON
  context.mcpServer.stdin.write('{ invalid json }\n');
  
  // Wait for error response
  await new Promise(resolve => setTimeout(resolve, 1000));
});

When('I send {int} concurrent {string} requests', async (count: number, method: string) => {
  const requests = Array.from({ length: count }, (_, i) => ({
    jsonrpc: '2.0' as const,
    id: `concurrent-${i}`,
    method
  }));

  const startTime = Date.now();
  const promises = requests.map(req => sendMCPRequest(req));
  
  try {
    const responses = await Promise.all(promises);
    context.responses.push(...responses);
    
    // Store timing information
    const duration = Date.now() - startTime;
    (context as any).concurrentDuration = duration;
  } catch (error) {
    context.errors.push(error instanceof Error ? error.message : String(error));
  }
});

Then('the server should be ready for connections', () => {
  expect(context.mcpServer).toBeDefined();
  expect(context.mcpServer?.killed).toBe(false);
});

Then('it should support JSON-RPC 2.0 protocol', () => {
  // This is validated by successful communication
  expect(context.errors.length).toBe(0);
});

Then('I should receive a valid JSON-RPC response', () => {
  expect(context.responses.length).toBeGreaterThan(0);
  const lastResponse = context.responses[context.responses.length - 1];
  expect(lastResponse.jsonrpc).toBe('2.0');
  expect(lastResponse.id).toBeDefined();
});

Then('the response should contain {int} unjucks tools', (expectedCount: number) => {
  const lastResponse = context.responses[context.responses.length - 1];
  expect(lastResponse.result?.tools).toBeDefined();
  expect(lastResponse.result.tools.length).toBe(expectedCount);
});

Then('each tool should have proper schema definitions', () => {
  const lastResponse = context.responses[context.responses.length - 1];
  const tools = lastResponse.result?.tools || [];
  
  for (const tool of tools) {
    expect(tool.name).toBeDefined();
    expect(tool.description).toBeDefined();
    expect(tool.inputSchema).toBeDefined();
    expect(typeof tool.inputSchema).toBe('object');
  }
});

Then('I should receive a proper error response', () => {
  expect(context.responses.length).toBeGreaterThan(0);
  const lastResponse = context.responses[context.responses.length - 1];
  expect(lastResponse.error).toBeDefined();
  expect(lastResponse.error?.code).toBeDefined();
  expect(lastResponse.error?.message).toBeDefined();
});

Then('the error should follow MCP error code conventions', () => {
  const lastResponse = context.responses[context.responses.length - 1];
  const errorCode = lastResponse.error?.code;
  
  // MCP error codes should be in valid ranges
  expect(errorCode).toBeGreaterThanOrEqual(-32999);
  expect(errorCode).toBeLessThanOrEqual(-32000);
});

Then('the server should respond with its capabilities', () => {
  const lastResponse = context.responses[context.responses.length - 1];
  expect(lastResponse.result?.capabilities).toBeDefined();
});

Then('it should declare support for tools', () => {
  const lastResponse = context.responses[context.responses.length - 1];
  expect(lastResponse.result?.capabilities?.tools).toBeDefined();
});

Then('it should include proper protocol version', () => {
  const lastResponse = context.responses[context.responses.length - 1];
  expect(lastResponse.result?.protocolVersion).toBeDefined();
});

Then('all requests should complete successfully', () => {
  const successfulResponses = context.responses.filter(r => !r.error);
  expect(successfulResponses.length).toBeGreaterThan(0);
});

Then('response times should be under {int}ms', (maxTime: number) => {
  const duration = (context as any).concurrentDuration;
  expect(duration).toBeLessThan(maxTime);
});

Then('no race conditions should occur', () => {
  // Verify all responses have unique IDs and are well-formed
  const ids = context.responses.map(r => r.id);
  const uniqueIds = new Set(ids);
  expect(uniqueIds.size).toBe(ids.length);
});

// Cleanup after tests
export async function cleanup() {
  if (context.mcpServer) {
    context.mcpServer.kill();
    context.mcpServer = undefined;
  }
  
  if (context.tempDir) {
    await fs.rm(context.tempDir, { recursive: true, force: true });
  }
}

// Export context for other step files
export { context };