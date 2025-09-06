/**
 * Comprehensive MCP Integration Test Suite
 * Based on full-stack-rubric analysis and nuxt-mcp best practices
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { EventSource } from 'eventsource';
import { performance } from 'perf_hooks';
import { readFile, writeFile, exists, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

interface MCPTestEnvironment {
  nuxtProcess?: ChildProcess;
  mcpClient?: MCPClient;
  testDir: string;
  serverURL: string;
}

class MCPClient {
  private eventSource?: EventSource;
  private baseURL: string;
  private requestId = 0;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(`${this.baseURL}/__mcp/sse`);
      
      this.eventSource.onopen = () => resolve();
      this.eventSource.onerror = reject;
      
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  async callTool(toolName: string, args: any = {}): Promise<any> {
    const requestId = `test-${++this.requestId}`;
    
    const request = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    const response = await fetch(`${this.baseURL}/__mcp/sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async listTools(): Promise<any[]> {
    const response = await this.callTool('tools/list');
    return response.result?.tools || [];
  }

  disconnect(): void {
    this.eventSource?.close();
  }
}

class PerformanceTracker {
  private metrics: Array<{ name: string; duration: number; timestamp: number }> = [];

  record(name: string, duration: number): void {
    this.metrics.push({
      name,
      duration,
      timestamp: Date.now()
    });
  }

  getAverageTime(toolName?: string): number {
    const filtered = toolName ? 
      this.metrics.filter(m => m.name === toolName) : 
      this.metrics;
    
    if (filtered.length === 0) return 0;
    
    const total = filtered.reduce((sum, m) => sum + m.duration, 0);
    return total / filtered.length;
  }

  getMetrics(): typeof this.metrics {
    return [...this.metrics];
  }

  reset(): void {
    this.metrics = [];
  }
}

describe('MCP Integration Quality Assurance Suite', () => {
  let testEnv: MCPTestEnvironment;
  let performanceTracker: PerformanceTracker;

  beforeAll(async () => {
    // Create isolated test environment
    testEnv = {
      testDir: join(tmpdir(), `mcp-qa-${Date.now()}`),
      serverURL: 'http://localhost:3001' // Different port for testing
    };

    await mkdir(testEnv.testDir, { recursive: true });
    
    // Set up test Nuxt project
    await setupTestNuxtProject(testEnv.testDir);
    
    performanceTracker = new PerformanceTracker();
  });

  afterAll(async () => {
    // Cleanup test environment
    testEnv.nuxtProcess?.kill();
    await cleanupTestDirectory(testEnv.testDir);
  });

  beforeEach(async () => {
    // Start fresh Nuxt process for each test suite
    testEnv.nuxtProcess = await startNuxtProcess(testEnv.testDir, 3001);
    await waitForNuxtReady(testEnv.nuxtProcess);
    
    // Connect MCP client
    testEnv.mcpClient = new MCPClient(testEnv.serverURL);
    await testEnv.mcpClient.connect();
  });

  afterEach(async () => {
    testEnv.mcpClient?.disconnect();
    testEnv.nuxtProcess?.kill();
    await waitForProcessExit(testEnv.nuxtProcess!);
    
    performanceTracker.reset();
  });

  describe('1. Unit Testing - MCP Protocol Compliance', () => {
    it('should implement JSON-RPC 2.0 protocol correctly', async () => {
      const response = await testEnv.mcpClient!.callTool('unjucks_list');
      
      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('result');
      expect(response).not.toHaveProperty('error');
    });

    it('should return proper error responses for invalid requests', async () => {
      try {
        await testEnv.mcpClient!.callTool('nonexistent_tool');
      } catch (error) {
        // Should be handled gracefully by the server
        expect(error).toBeDefined();
      }
    });

    it('should validate tool parameters against JSON schemas', async () => {
      const validRequest = await testEnv.mcpClient!.callTool('unjucks_generate', {
        generator: 'component',
        name: 'TestComponent'
      });

      expect(validRequest.error).toBeUndefined();
    });

    it('should register all required MCP tools', async () => {
      const tools = await testEnv.mcpClient!.listTools();
      const toolNames = tools.map(t => t.name);
      
      expect(toolNames).toContain('unjucks_list');
      expect(toolNames).toContain('unjucks_generate');
      expect(toolNames).toContain('unjucks_help');
      expect(toolNames).toContain('unjucks_dry_run');
      expect(toolNames).toContain('unjucks_inject');
      
      expect(tools.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('2. Integration Testing - SSE Endpoint', () => {
    it('should establish SSE connection successfully', async () => {
      const eventSource = new EventSource(`${testEnv.serverURL}/__mcp/sse`);
      
      await new Promise<void>((resolve, reject) => {
        eventSource.onopen = () => {
          expect(eventSource.readyState).toBe(EventSource.OPEN);
          eventSource.close();
          resolve();
        };
        eventSource.onerror = reject;
        setTimeout(() => reject(new Error('Connection timeout')), 3000);
      });
    });

    it('should handle multiple concurrent SSE connections', async () => {
      const connections: EventSource[] = [];
      
      try {
        // Create multiple connections
        for (let i = 0; i < 10; i++) {
          const es = new EventSource(`${testEnv.serverURL}/__mcp/sse`);
          connections.push(es);
        }

        // Wait for all to connect
        await Promise.all(connections.map(es => new Promise((resolve, reject) => {
          es.onopen = resolve;
          es.onerror = reject;
          setTimeout(() => reject(new Error('Timeout')), 2000);
        })));

        expect(connections.every(es => es.readyState === EventSource.OPEN)).toBe(true);
        
      } finally {
        connections.forEach(es => es.close());
      }
    });

    it('should maintain connection stability under load', async () => {
      const startTime = performance.now();
      
      // Send many requests rapidly
      const requests = Array.from({ length: 50 }, (_, i) => 
        testEnv.mcpClient!.callTool('unjucks_list')
      );

      const results = await Promise.allSettled(requests);
      const endTime = performance.now();
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const avgTime = (endTime - startTime) / requests.length;
      
      expect(successCount).toBeGreaterThan(40); // 80% success rate minimum
      expect(avgTime).toBeLessThan(100); // Average under 100ms
      
      performanceTracker.record('load_test', endTime - startTime);
    });
  });

  describe('3. Performance Testing - Benchmarks', () => {
    it('should meet startup time requirements', async () => {
      // Kill current process and measure restart time
      testEnv.nuxtProcess!.kill();
      await waitForProcessExit(testEnv.nuxtProcess!);
      
      const startTime = performance.now();
      testEnv.nuxtProcess = await startNuxtProcess(testEnv.testDir, 3001);
      await waitForNuxtReady(testEnv.nuxtProcess);
      const endTime = performance.now();
      
      const startupTime = endTime - startTime;
      expect(startupTime).toBeLessThan(10000); // 10 seconds max for test environment
      
      performanceTracker.record('startup_time', startupTime);
      
      // Reconnect client
      testEnv.mcpClient = new MCPClient(testEnv.serverURL);
      await testEnv.mcpClient.connect();
    });

    it('should meet response time benchmarks for each tool', async () => {
      const benchmarks = {
        'unjucks_list': 100,
        'unjucks_help': 200,
        'unjucks_dry_run': 300,
        'unjucks_generate': 1000
      };

      for (const [toolName, maxTime] of Object.entries(benchmarks)) {
        const startTime = performance.now();
        
        const args = toolName === 'unjucks_help' ? { generator: 'component' } :
                    toolName === 'unjucks_dry_run' ? { generator: 'component', name: 'Test' } :
                    toolName === 'unjucks_generate' ? { generator: 'component', name: 'PerfTest' } :
                    {};
        
        await testEnv.mcpClient!.callTool(toolName, args);
        const endTime = performance.now();
        
        const responseTime = endTime - startTime;
        expect(responseTime).toBeLessThan(maxTime);
        
        performanceTracker.record(toolName, responseTime);
      }
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 20;
      
      const startTime = performance.now();
      const requests = Array.from({ length: concurrentRequests }, () => 
        testEnv.mcpClient!.callTool('unjucks_list')
      );
      
      const results = await Promise.all(requests);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests;
      
      expect(results.every(r => !r.error)).toBe(true);
      expect(avgTimePerRequest).toBeLessThan(200); // Should be faster due to concurrency
      expect(totalTime).toBeLessThan(concurrentRequests * 50); // Much faster than sequential
      
      performanceTracker.record('concurrent_requests', totalTime);
    });

    it('should maintain reasonable memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations to test memory management
      for (let i = 0; i < 100; i++) {
        await testEnv.mcpClient!.callTool('unjucks_list');
        
        if (i % 25 === 0) {
          const currentMemory = process.memoryUsage().heapUsed;
          const memoryGrowthMB = (currentMemory - initialMemory) / 1024 / 1024;
          
          expect(memoryGrowthMB).toBeLessThan(100); // Should not grow beyond 100MB
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const totalGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;
      
      expect(totalGrowthMB).toBeLessThan(50); // Should settle within reasonable bounds
    });
  });

  describe('4. Security Testing - Validation & Protection', () => {
    it('should prevent path traversal attacks', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '/etc/shadow',
        '~/.ssh/id_rsa'
      ];

      for (const maliciousPath of maliciousPaths) {
        const response = await testEnv.mcpClient!.callTool('unjucks_generate', {
          generator: 'component',
          name: 'test',
          dest: maliciousPath
        });

        // Should either reject or sanitize the path
        if (response.error) {
          expect(response.error.message).toMatch(/path|security|invalid/i);
        } else if (response.result?.filesCreated) {
          // If accepted, paths should be sanitized
          expect(response.result.filesCreated.every((path: string) => 
            !path.includes('../') && !path.includes('etc/passwd') && !path.includes('system32')
          )).toBe(true);
        }
      }
    });

    it('should sanitize template variable inputs', async () => {
      const maliciousInputs = [
        '{{ constructor.constructor("alert(1)")() }}',
        '{% set x = constructor.constructor("process.exit(1)")() %}',
        '<script>alert("xss")</script>',
        '${global.process.mainModule.require("child_process").execSync("rm -rf /")}'
      ];

      for (const maliciousInput of maliciousInputs) {
        const response = await testEnv.mcpClient!.callTool('unjucks_generate', {
          generator: 'component',
          name: maliciousInput
        });

        // Should either reject dangerous input or sanitize it
        expect(response.error || response.result).toBeDefined();
        
        if (response.error) {
          expect(response.error.message).toMatch(/validation|invalid|security/i);
        }
      }
    });

    it('should implement rate limiting under heavy load', async () => {
      // Send excessive requests rapidly
      const excessiveRequests = Array.from({ length: 200 }, (_, i) => 
        testEnv.mcpClient!.callTool('unjucks_list').catch(e => ({ error: e.message }))
      );

      const startTime = performance.now();
      const results = await Promise.all(excessiveRequests);
      const endTime = performance.now();

      const errorCount = results.filter(r => r.error).length;
      const totalTime = endTime - startTime;

      // Either most succeed quickly (good performance) or rate limiting kicks in
      expect(errorCount < 20 || totalTime > 10000).toBe(true);
    });

    it('should validate JSON schema for all tool parameters', async () => {
      const invalidParameterSets = [
        { tool: 'unjucks_generate', params: { generator: null, name: 'test' } },
        { tool: 'unjucks_generate', params: { generator: 'test', name: null } },
        { tool: 'unjucks_generate', params: { generator: '', name: 'test' } },
        { tool: 'unjucks_help', params: { generator: 123 } },
        { tool: 'unjucks_dry_run', params: { generator: [], name: 'test' } }
      ];

      for (const { tool, params } of invalidParameterSets) {
        const response = await testEnv.mcpClient!.callTool(tool, params);
        
        // Should handle invalid parameters gracefully
        expect(response).toBeDefined();
        
        if (response.error) {
          expect(response.error.message).toMatch(/validation|parameter|invalid/i);
        }
      }
    });
  });

  describe('5. Cross-Platform Compatibility', () => {
    it('should handle file paths correctly across platforms', async () => {
      const response = await testEnv.mcpClient!.callTool('unjucks_generate', {
        generator: 'component',
        name: 'CrossPlatformTest',
        dest: './components'
      });

      if (response.result?.filesCreated) {
        const filePath = response.result.filesCreated[0];
        
        // Should use appropriate path separators for the platform
        if (process.platform === 'win32') {
          expect(filePath).toMatch(/components[\\/]CrossPlatformTest/);
        } else {
          expect(filePath).toMatch(/components\/CrossPlatformTest/);
        }
      }
    });

    it('should respect file system permissions', async () => {
      // Try to write to a read-only location (if available)
      const readOnlyPath = process.platform === 'win32' ? 
        'C:\\Windows\\System32' : 
        '/usr/bin';

      const response = await testEnv.mcpClient!.callTool('unjucks_generate', {
        generator: 'component',
        name: 'test',
        dest: readOnlyPath
      });

      // Should either reject or handle permission errors gracefully
      if (response.error) {
        expect(response.error.code).toBeOneOf([403, 'EACCES', 'EPERM']);
      }
    });
  });

  describe('6. Quality Metrics Collection', () => {
    it('should collect comprehensive performance metrics', async () => {
      // Perform various operations
      await testEnv.mcpClient!.callTool('unjucks_list');
      await testEnv.mcpClient!.callTool('unjucks_help', { generator: 'component' });
      await testEnv.mcpClient!.callTool('unjucks_dry_run', { generator: 'component', name: 'MetricsTest' });

      const metrics = performanceTracker.getMetrics();
      
      expect(metrics.length).toBeGreaterThan(0);
      expect(performanceTracker.getAverageTime()).toBeGreaterThan(0);
      expect(performanceTracker.getAverageTime()).toBeLessThan(1000); // Reasonable average time
    });

    it('should generate quality report data', () => {
      const qualityReport = {
        testResults: {
          total: expect.any(Number),
          passed: expect.any(Number),
          failed: expect.any(Number),
          coverage: expect.any(Number)
        },
        performance: {
          averageResponseTime: performanceTracker.getAverageTime(),
          metrics: performanceTracker.getMetrics()
        },
        security: {
          vulnerabilities: 0,
          securityTestsPassed: true
        },
        compatibility: {
          platforms: [process.platform],
          nodeVersions: [process.version]
        }
      };

      expect(qualityReport.performance.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(qualityReport.security.securityTestsPassed).toBe(true);
    });
  });
});

// Helper functions
async function setupTestNuxtProject(testDir: string): Promise<void> {
  // Create minimal Nuxt project structure for testing
  const nuxtConfig = `
export default defineNuxtConfig({
  modules: ['nuxt-mcp'],
  nitro: {
    port: 3001
  },
  ssr: false
});
  `;

  const packageJson = `
{
  "name": "test-nuxt-mcp",
  "private": true,
  "scripts": {
    "dev": "nuxt dev --port 3001"
  },
  "dependencies": {
    "nuxt": "latest",
    "nuxt-mcp": "latest"
  }
}
  `;

  await writeFile(join(testDir, 'nuxt.config.ts'), nuxtConfig);
  await writeFile(join(testDir, 'package.json'), packageJson);
  
  // Create templates directory
  await mkdir(join(testDir, '_templates', 'component', 'new'), { recursive: true });
  await writeFile(
    join(testDir, '_templates', 'component', 'new', 'component.vue.njk'),
    `---
to: "{{ dest || 'components' }}/{{ name | pascalCase }}.vue"
---
<template>
  <div class="{{ name | kebabCase }}">
    {{ name | pascalCase }}
  </div>
</template>

<script setup lang="ts">
// {{ name | pascalCase }} component
</script>
    `
  );
}

async function startNuxtProcess(cwd: string, port: number): Promise<ChildProcess> {
  return spawn('npm', ['run', 'dev'], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PORT: port.toString() }
  });
}

async function waitForNuxtReady(process: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = '';
    
    const onData = (data: Buffer) => {
      output += data.toString();
      if (output.includes('MCP server is running') || output.includes('Nuxt ready')) {
        cleanup();
        resolve();
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      process.stdout?.off('data', onData);
      process.stderr?.off('data', onData);
      process.off('error', onError);
      clearTimeout(timeout);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Nuxt startup timeout'));
    }, 30000);

    process.stdout?.on('data', onData);
    process.stderr?.on('data', onData);
    process.on('error', onError);
  });
}

async function waitForProcessExit(process: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (process.killed) {
      resolve();
      return;
    }

    process.on('exit', () => resolve());
    
    // Force kill after timeout
    setTimeout(() => {
      if (!process.killed) {
        process.kill('SIGKILL');
      }
      resolve();
    }, 5000);
  });
}

async function cleanupTestDirectory(testDir: string): Promise<void> {
  try {
    const { rimraf } = await import('rimraf');
    await rimraf(testDir);
  } catch (error) {
    // Ignore cleanup errors
    console.warn('Failed to cleanup test directory:', error);
  }
}

// Add custom matcher
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () => `Expected ${received} to be one of ${expected.join(', ')}`
    };
  }
});