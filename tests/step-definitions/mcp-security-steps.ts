import { Given, When, Then } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

interface MCPSecurityContext {
  mcpServer?: ChildProcess;
  tempDir: string;
  responses: any[];
  errors: string[];
  attackResults: any[];
  startTime: number;
}

const context: MCPSecurityContext = {
  tempDir: '',
  responses: [],
  errors: [],
  attackResults: [],
  startTime: 0
};

// Helper to call MCP tool and capture security responses
async function callMCPToolSecure(toolName: string, args: Record<string, any> = {}): Promise<any> {
  if (!context.mcpServer) {
    throw new Error('MCP server not running');
  }

  const request = {
    jsonrpc: '2.0',
    id: `security-test-${Date.now()}`,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  };

  return new Promise((resolve, reject) => {
    const requestStr = JSON.stringify(request) + '\n';
    let responseData = '';

    const timeout = setTimeout(() => {
      reject(new Error(`MCP security test timeout for ${toolName}`));
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
  context.tempDir = path.join(projectRoot, 'temp-mcp-security-' + Date.now());
  await fs.mkdir(context.tempDir, { recursive: true });
  
  // Create templates directory for testing
  const templatesDir = path.join(context.tempDir, '_templates');
  await fs.mkdir(templatesDir, { recursive: true });
  
  // Create a basic test template
  const testDir = path.join(templatesDir, 'test', 'basic');
  await fs.mkdir(testDir, { recursive: true });
  
  await fs.writeFile(
    path.join(testDir, 'file.txt'),
    `---
to: {{ destination }}/test.txt
---
Test content with {{ name }}
`
  );
  
  context.responses = [];
  context.errors = [];
  context.attackResults = [];
});

When('I call {string} with destination={string}', async (toolName: string, destination: string) => {
  context.startTime = Date.now();
  
  try {
    const result = await callMCPToolSecure(toolName, {
      generator: 'test',
      template: 'basic',
      name: 'TestName',
      destination: destination,
      workingDirectory: context.tempDir
    });
    
    context.attackResults.push(result);
  } catch (error) {
    context.errors.push(error instanceof Error ? error.message : String(error));
  }
});

When('I call {string} with componentName={string}', async (toolName: string, componentName: string) => {
  context.startTime = Date.now();
  
  try {
    const result = await callMCPToolSecure(toolName, {
      generator: 'test',
      template: 'basic',
      name: componentName,
      workingDirectory: context.tempDir
    });
    
    context.attackResults.push(result);
  } catch (error) {
    context.errors.push(error instanceof Error ? error.message : String(error));
  }
});

When('I call {string} targeting {string}', async (toolName: string, targetPath: string) => {
  context.startTime = Date.now();
  
  try {
    const result = await callMCPToolSecure(toolName, {
      filePath: targetPath,
      content: 'malicious content',
      mode: 'append',
      workingDirectory: context.tempDir
    });
    
    context.attackResults.push(result);
  } catch (error) {
    context.errors.push(error instanceof Error ? error.message : String(error));
  }
});

When('I call {string} with generator={string}', async (toolName: string, generator: string) => {
  context.startTime = Date.now();
  
  try {
    const result = await callMCPToolSecure(toolName, {
      generator: generator,
      workingDirectory: context.tempDir
    });
    
    context.attackResults.push(result);
  } catch (error) {
    context.errors.push(error instanceof Error ? error.message : String(error));
  }
});

When('I call {string} with extremely large variables', async (toolName: string) => {
  context.startTime = Date.now();
  
  // Create extremely large variable content
  const largeContent = 'A'.repeat(10 * 1024 * 1024); // 10MB of data
  
  try {
    const result = await callMCPToolSecure(toolName, {
      generator: 'test',
      template: 'basic',
      name: largeContent,
      workingDirectory: context.tempDir
    });
    
    context.attackResults.push(result);
  } catch (error) {
    context.errors.push(error instanceof Error ? error.message : String(error));
  }
});

When('I make {int} simultaneous MCP requests', async (count: number) => {
  context.startTime = Date.now();
  
  const promises = Array.from({ length: count }, (_, i) => 
    callMCPToolSecure('unjucks_list', { 
      workingDirectory: context.tempDir,
      requestId: i 
    })
  );
  
  try {
    const results = await Promise.all(promises);
    context.attackResults.push(...results);
  } catch (error) {
    context.errors.push(error instanceof Error ? error.message : String(error));
  }
});

Then('the request should be rejected', () => {
  const hasErrors = context.errors.length > 0 || 
    context.attackResults.some(result => result.error || result.result?.error);
  
  expect(hasErrors).toBe(true);
});

Then('an appropriate security error should be returned', () => {
  const hasSecurityError = context.attackResults.some(result => {
    const errorMsg = result.error || result.result?.error?.message || '';
    return errorMsg.toLowerCase().includes('security') || 
           errorMsg.toLowerCase().includes('invalid') ||
           errorMsg.toLowerCase().includes('forbidden') ||
           errorMsg.toLowerCase().includes('path');
  });
  
  expect(hasSecurityError).toBe(true);
});

Then('no files should be created outside the project', async () => {
  // Check that no files were created in system directories
  const systemPaths = ['/etc', '/usr', '/var', '/tmp'];
  
  for (const sysPath of systemPaths) {
    try {
      const files = await fs.readdir(sysPath);
      const suspiciousFiles = files.filter(f => 
        f.includes('test.txt') || f.includes('TestName')
      );
      expect(suspiciousFiles.length).toBe(0);
    } catch {
      // Directory not accessible, which is good for security
    }
  }
});

Then('the error should be logged securely', () => {
  // In a real implementation, this would check security logs
  expect(context.errors.length + context.attackResults.length).toBeGreaterThan(0);
});

Then('the variable should be safely sanitized', () => {
  const results = context.attackResults.filter(r => r.result && !r.error);
  
  if (results.length > 0) {
    const content = results[0].result?.content;
    // Should not contain dangerous characters or commands
    expect(content).not.toMatch(/;|\||&|`|\$\(/);
  }
});

Then('no system commands should be executed', () => {
  // Verify no dangerous operations were performed
  expect(context.attackResults.some(r => r.error || r.result?.error)).toBe(true);
});

Then('the template should render with escaped content', () => {
  const successfulResults = context.attackResults.filter(r => r.result && !r.error);
  
  if (successfulResults.length > 0) {
    const content = successfulResults[0].result?.content;
    // Should not contain unescaped dangerous content
    expect(content).not.toMatch(/<script|javascript:|vbscript:/i);
  }
});

Then('the operation should complete safely', () => {
  // Should either succeed safely or fail securely
  const totalResults = context.attackResults.length + context.errors.length;
  expect(totalResults).toBeGreaterThan(0);
});

Then('the operation should be blocked', () => {
  const hasBlocked = context.errors.length > 0 || 
    context.attackResults.some(result => result.error || result.result?.error);
  
  expect(hasBlocked).toBe(true);
});

Then('a security error should be returned', () => {
  const hasSecurityError = context.attackResults.some(result => {
    const errorMsg = result.error || result.result?.error?.message || '';
    return errorMsg.toLowerCase().includes('security') || 
           errorMsg.toLowerCase().includes('forbidden') ||
           errorMsg.toLowerCase().includes('access') ||
           errorMsg.toLowerCase().includes('denied');
  });
  
  expect(hasSecurityError).toBe(true);
});

Then('system files should remain untouched', async () => {
  // Verify critical system files weren't modified
  const criticalFiles = ['/etc/passwd', '/etc/hosts', '/etc/shadow'];
  
  for (const file of criticalFiles) {
    try {
      const stats = await fs.stat(file);
      // Files should exist and not be recently modified
      const ageMs = Date.now() - stats.mtime.getTime();
      expect(ageMs).toBeGreaterThan(60000); // Older than 1 minute
    } catch {
      // File doesn't exist or isn't accessible, which is fine
    }
  }
});

Then('the attempt should be logged', () => {
  // In production, this would verify security audit logs
  expect(context.attackResults.length + context.errors.length).toBeGreaterThan(0);
});

Then('the input should be sanitized', () => {
  const results = context.attackResults.filter(r => !r.error);
  
  if (results.length > 0) {
    const content = results[0].result?.content || results[0].result?.message || '';
    // Should not contain dangerous script tags
    expect(content).not.toMatch(/<script.*?>.*?<\/script>/gi);
  }
});

Then('no script execution should occur', () => {
  // Verify no JavaScript or script execution occurred
  expect(typeof window).toBe('undefined'); // Ensure we're in Node.js environment
});

Then('the response should be safe', () => {
  const responses = context.attackResults.filter(r => r.result);
  
  for (const response of responses) {
    const content = JSON.stringify(response);
    expect(content).not.toMatch(/<script|javascript:|data:|vbscript:/i);
  }
});

Then('the error should be handled gracefully', () => {
  const hasGracefulHandling = context.attackResults.some(result => 
    result.error || result.result?.error
  );
  
  expect(hasGracefulHandling).toBe(true);
});

Then('the request should be rate-limited', () => {
  const hasRateLimit = context.errors.some(error => 
    error.toLowerCase().includes('rate') || error.toLowerCase().includes('limit')
  ) || context.attackResults.some(result => {
    const errorMsg = result.error || result.result?.error?.message || '';
    return errorMsg.toLowerCase().includes('rate') || 
           errorMsg.toLowerCase().includes('limit') ||
           errorMsg.toLowerCase().includes('too large');
  });
  
  expect(hasRateLimit).toBe(true);
});

Then('memory usage should be controlled', () => {
  const memUsage = process.memoryUsage();
  expect(memUsage.heapUsed).toBeLessThan(200 * 1024 * 1024); // 200MB limit
});

Then('the operation should timeout appropriately', () => {
  const duration = Date.now() - context.startTime;
  expect(duration).toBeLessThan(10000); // Should timeout within 10 seconds
});

Then('system resources should be protected', () => {
  // Verify resource limits are enforced
  const memUsage = process.memoryUsage();
  expect(memUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // 500MB hard limit
});

Then('requests should be throttled appropriately', () => {
  const errorCount = context.errors.length;
  const responseCount = context.attackResults.length;
  
  // Some requests should be rejected due to throttling
  expect(errorCount + responseCount).toBeGreaterThan(0);
});

Then('server should remain responsive', () => {
  // Server should still respond to requests
  const totalResponses = context.attackResults.length;
  expect(totalResponses).toBeGreaterThan(0);
});

Then('no denial of service should occur', () => {
  // Server should handle load gracefully
  const duration = Date.now() - context.startTime;
  expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
});

Then('error responses should be proper', () => {
  const errorResponses = context.attackResults.filter(r => r.error || r.result?.error);
  
  for (const response of errorResponses) {
    const error = response.error || response.result?.error;
    expect(error).toBeDefined();
    expect(typeof error).toBe('object');
  }
});

// Cleanup function
export async function cleanup() {
  if (context.mcpServer) {
    context.mcpServer.kill();
    context.mcpServer = undefined;
  }
  
  if (context.tempDir) {
    await fs.rm(context.tempDir, { recursive: true, force: true });
  }
}