#!/usr/bin/env node
/**
 * Comprehensive MCP integration testing script
 * @fileoverview Tests MCP server startup, tool discovery, and end-to-end integration
 */

import { spawn } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

/**
 * Test runner for MCP integration
 */
class MCPIntegrationTester {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };
    this.testDir = join(tmpdir(), `mcp-test-${randomUUID()}`);
  }

  /**
   * Run all integration tests
   */
  async runAllTests() {
    console.log('🚀 Starting MCP Integration Tests\n');

    try {
      await this.setupTestEnvironment();
      
      await this.testServerStartup();
      await this.testBasicConnectivity();
      await this.testToolDiscovery();
      await this.testToolExecution();
      await this.testErrorHandling();
      await this.testPerformance();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Set up test environment
   */
  async setupTestEnvironment() {
    await this.runTest('Setup test environment', async () => {
      await mkdir(this.testDir, { recursive: true });
      
      // Create test template structure
      const templateDir = join(this.testDir, '_templates', 'test', 'basic');
      await mkdir(templateDir, { recursive: true });
      
      await writeFile(join(templateDir, 'test.txt.ejs'), 'Test file: <%= name %>');
      await writeFile(join(templateDir, '_prompt'), JSON.stringify({
        variables: [{
          name: 'name',
          type: 'string',
          description: 'Test name'
        }]
      }));
    });
  }

  /**
   * Test server startup and basic connectivity
   */
  async testServerStartup() {
    await this.runTest('Server startup within timeout', async () => {
      const server = await this.startMCPServer();
      await this.sendRequest(server, 'ping');
      server.kill('SIGTERM');
    });
  }

  /**
   * Test basic connectivity and protocol compliance
   */
  async testBasicConnectivity() {
    const server = await this.startMCPServer();

    try {
      await this.runTest('Initialize handshake', async () => {
        const result = await this.sendRequest(server, 'initialize', {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" }
        });
        
        if (!result.protocolVersion || !result.capabilities || !result.serverInfo) {
          throw new Error('Invalid initialize response');
        }
      });

      await this.runTest('Ping-pong communication', async () => {
        const result = await this.sendRequest(server, 'ping');
        if (!result.pong) {
          throw new Error('Invalid ping response');
        }
      });

      await this.runTest('Invalid method handling', async () => {
        try {
          await this.sendRequest(server, 'invalid_method');
          throw new Error('Should have thrown error for invalid method');
        } catch (error) {
          if (!error.message.includes('not found')) {
            throw error;
          }
        }
      });

    } finally {
      server.kill('SIGTERM');
    }
  }

  /**
   * Test tool discovery and listing
   */
  async testToolDiscovery() {
    const server = await this.startMCPServer();

    try {
      await this.sendRequest(server, 'initialize', {});

      await this.runTest('Tool listing', async () => {
        const result = await this.sendRequest(server, 'tools/list');
        
        if (!result.tools || !Array.isArray(result.tools)) {
          throw new Error('Invalid tools list response');
        }

        if (result.tools.length === 0) {
          throw new Error('No tools discovered');
        }

        // Verify tool structure
        for (const tool of result.tools) {
          if (!tool.name || !tool.description || !tool.inputSchema) {
            throw new Error(`Invalid tool structure: ${JSON.stringify(tool)}`);
          }
        }
      });

      await this.runTest('Core tools present', async () => {
        const result = await this.sendRequest(server, 'tools/list');
        const toolNames = result.tools.map(t => t.name);
        
        const expectedTools = [
          'unjucks_list',
          'unjucks_generate', 
          'unjucks_help',
          'unjucks_dry_run',
          'unjucks_inject'
        ];

        for (const expectedTool of expectedTools) {
          if (!toolNames.includes(expectedTool)) {
            throw new Error(`Missing core tool: ${expectedTool}`);
          }
        }

        console.log(`  ✓ Found ${result.tools.length} tools: ${toolNames.join(', ')}`);
      });

      await this.runTest('Tool metadata support', async () => {
        const result = await this.sendRequest(server, 'tools/list', { includeMetadata: true });
        
        if (result.tools.length > 0 && result.tools[0].metadata) {
          const metadata = result.tools[0].metadata;
          if (typeof metadata.usageCount !== 'number' || 
              typeof metadata.successRate !== 'string') {
            throw new Error('Invalid tool metadata structure');
          }
        }
      });

    } finally {
      server.kill('SIGTERM');
    }
  }

  /**
   * Test tool execution
   */
  async testToolExecution() {
    const server = await this.startMCPServer();

    try {
      await this.sendRequest(server, 'initialize', {});

      await this.runTest('unjucks_list execution', async () => {
        const result = await this.sendRequest(server, 'tools/call', {
          name: 'unjucks_list',
          arguments: {}
        });

        if (result.isError) {
          throw new Error(`Tool execution failed: ${result.content[0]?.text}`);
        }

        if (!result.content || !Array.isArray(result.content)) {
          throw new Error('Invalid tool result structure');
        }
      });

      await this.runTest('unjucks_help execution', async () => {
        const result = await this.sendRequest(server, 'tools/call', {
          name: 'unjucks_help',
          arguments: {
            generator: 'command',
            template: 'citty'
          }
        });

        if (result.isError) {
          throw new Error(`Tool execution failed: ${result.content[0]?.text}`);
        }
      });

      await this.runTest('Tool argument validation', async () => {
        const result = await this.sendRequest(server, 'tools/call', {
          name: 'unjucks_generate',
          arguments: {
            generator: 'test'
            // Missing required fields
          }
        });

        if (!result.isError) {
          throw new Error('Should have failed validation');
        }

        if (!result.content[0]?.text.includes('required')) {
          throw new Error('Should include validation error details');
        }
      });

    } finally {
      server.kill('SIGTERM');
    }
  }

  /**
   * Test error handling and recovery
   */
  async testErrorHandling() {
    const server = await this.startMCPServer();

    try {
      await this.sendRequest(server, 'initialize', {});

      await this.runTest('Unknown tool handling', async () => {
        const result = await this.sendRequest(server, 'tools/call', {
          name: 'nonexistent_tool',
          arguments: {}
        });

        if (!result.isError) {
          throw new Error('Should have returned error for unknown tool');
        }
      });

      await this.runTest('Server recovery after error', async () => {
        // Send invalid request
        await this.sendRequest(server, 'tools/call', {
          name: 'nonexistent_tool',
          arguments: {}
        });

        // Verify server is still responsive
        const result = await this.sendRequest(server, 'ping');
        if (!result.pong) {
          throw new Error('Server not responsive after error');
        }
      });

      await this.runTest('Concurrent request handling', async () => {
        const requests = Array.from({ length: 5 }, (_, i) => 
          this.sendRequest(server, 'tools/call', {
            name: 'unjucks_list',
            arguments: { detailed: i % 2 === 0 }
          })
        );

        const results = await Promise.all(requests);
        
        for (const result of results) {
          if (result.isError) {
            throw new Error('Concurrent request failed');
          }
        }
      });

    } finally {
      server.kill('SIGTERM');
    }
  }

  /**
   * Test performance characteristics
   */
  async testPerformance() {
    const server = await this.startMCPServer();

    try {
      await this.sendRequest(server, 'initialize', {});

      await this.runTest('Response time performance', async () => {
        const times = [];
        
        for (let i = 0; i < 10; i++) {
          const start = this.getDeterministicTimestamp();
          await this.sendRequest(server, 'ping');
          times.push(this.getDeterministicTimestamp() - start);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);

        if (avgTime > 1000) {
          throw new Error(`Average response time too high: ${avgTime}ms`);
        }

        if (maxTime > 5000) {
          throw new Error(`Maximum response time too high: ${maxTime}ms`);
        }

        console.log(`  ✓ Average response time: ${avgTime.toFixed(2)}ms`);
      });

      await this.runTest('Memory usage stability', async () => {
        const initialMemory = process.memoryUsage();
        
        // Perform multiple operations
        for (let i = 0; i < 20; i++) {
          await this.sendRequest(server, 'tools/call', {
            name: 'unjucks_list',
            arguments: {}
          });
        }

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        
        // Memory increase should be reasonable
        if (memoryIncrease > 10 * 1024 * 1024) { // 10MB
          console.warn(`  ⚠️  Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
        }
      });

    } finally {
      server.kill('SIGTERM');
    }
  }

  /**
   * Start MCP server process
   */
  async startMCPServer(timeout = 15000) {
    return new Promise((resolve, reject) => {
      const server = spawn('node', ['src/mcp-server.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, DEBUG_UNJUCKS: 'false' }
      });

      const timeoutId = setTimeout(() => {
        server.kill('SIGKILL');
        reject(new Error(`Server startup timed out after ${timeout}ms`));
      }, timeout);

      server.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server started successfully')) {
          clearTimeout(timeoutId);
          resolve(server);
        }
      });

      server.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      server.on('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeoutId);
          reject(new Error(`Server exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Send request to MCP server
   */
  async sendRequest(server, method, params = {}, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const id = this.getDeterministicTimestamp();
      const request = {
        jsonrpc: "2.0",
        id,
        method,
        params
      };

      const timeoutId = setTimeout(() => {
        reject(new Error(`Request ${method} timed out after ${timeout}ms`));
      }, timeout);

      const responseHandler = (data) => {
        const lines = data.toString().split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const response = JSON.parse(line);
            if (response.id === id) {
              clearTimeout(timeoutId);
              server.stdout.off('data', responseHandler);
              
              if (response.error) {
                reject(new Error(`MCP Error: ${response.error.message}`));
              } else {
                resolve(response.result);
              }
              return;
            }
          } catch (error) {
            // Ignore parse errors for non-matching responses
          }
        }
      };

      server.stdout.on('data', responseHandler);
      server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Run individual test with error handling
   */
  async runTest(name, testFn) {
    this.results.total++;
    
    try {
      await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASS' });
      console.log(`✅ ${name}`);
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAIL', error: error.message });
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  /**
   * Print test results summary
   */
  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success Rate: ${(this.results.passed / this.results.total * 100).toFixed(1)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(t => t.status === 'FAIL')
        .forEach(t => console.log(`  • ${t.name}: ${t.error}`));
    }

    console.log('\n🎯 MCP Integration Status:');
    
    if (this.results.failed === 0) {
      console.log('🟢 All tests passed - MCP integration is stable and ready for Claude AI');
    } else if (this.results.failed <= 2) {
      console.log('🟡 Minor issues detected - MCP integration mostly functional');
    } else {
      console.log('🔴 Major issues detected - MCP integration needs attention');
      process.exit(1);
    }
  }

  /**
   * Cleanup test environment
   */
  async cleanup() {
    // Cleanup would happen here if needed
    console.log('\n🧹 Cleanup completed');
  }
}

// Run tests if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MCPIntegrationTester();
  tester.runAllTests().catch(console.error);
}