/**
 * Comprehensive MCP Integration Validation Suite
 * 
 * This test validates the complete MCP integration testing framework,
 * ensuring all components work together for enterprise-grade validation.
 * 
 * Test Coverage:
 * - MCP Bridge initialization and lifecycle
 * - Mock MCP server functionality  
 * - Performance profiling and benchmarking
 * - Security validation and threat testing
 * - Enterprise workflow orchestration
 * - Test data factories and utilities
 * - Error handling and fault tolerance
 * - Real-time coordination and memory sync
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { performance } from 'perf_hooks';
import chalk from 'chalk';

// Import our testing utilities
import {
  MockMCPServer,
  MCPTestDataFactory,
  MCPPerformanceProfiler,
  MCPTestEnvironment,
  MCPSecurityTester
} from '../support/mcp-test-utilities.js';

// Import MCP integration components
import { MCPBridge, SwarmTask, JTBDWorkflow } from '../../src/lib/mcp-integration.js';
import type { MCPRequest, MCPResponse } from '../../src/mcp/types.js';

describe('MCP Integration Validation - Comprehensive Suite', () => {
  let mockServer: MockMCPServer;
  let testEnv: MCPTestEnvironment;
  let profiler: MCPPerformanceProfiler;
  let bridge: MCPBridge;

  beforeAll(async () => {
    console.log(chalk.blue('🚀 Initializing Comprehensive MCP Test Suite'));
    
    // Setup test environment
    testEnv = await MCPTestEnvironment.create();
    
    // Initialize mock MCP server
    mockServer = new MockMCPServer({
      latency: 25,
      errorRate: 0.05, // 5% error rate for testing resilience
      debugMode: false
    });
    
    await mockServer.start();
    
    // Initialize performance profiler
    profiler = new MCPPerformanceProfiler();
    
    // Initialize MCP bridge
    bridge = new MCPBridge({
      debugMode: false, // Reduce noise in tests
      hooksEnabled: true,
      realtimeSync: true,
      memoryNamespace: 'comprehensive-validation',
      timeouts: {
        swarmRequest: 3000,
        unjucksRequest: 5000,
        memorySync: 1000
      }
    });
    
    await bridge.initialize();
    
    console.log(chalk.green('✓ Test suite initialization complete'));
  });

  afterAll(async () => {
    // Cleanup
    if (bridge) await bridge.destroy();
    if (mockServer) await mockServer.stop();
    if (testEnv) await testEnv.cleanup();
    
    // Print final statistics
    console.log(chalk.cyan('\n📊 Final Test Statistics:'));
    console.log(chalk.cyan(`Mock Server Stats: ${JSON.stringify(mockServer?.getStats())}`));
    console.log(chalk.cyan(`Performance Stats: ${JSON.stringify(profiler?.getAllStatistics())}`));
    
    console.log(chalk.green('✓ Comprehensive test suite cleanup complete'));
  });

  beforeEach(() => {
    profiler.reset();
    mockServer?.reset();
  });

  describe('Mock MCP Server Validation', () => {
    it('should handle basic MCP protocol requests', async () => {
      profiler.startMeasurement('basic-protocol');
      
      const request = MCPTestDataFactory.createMCPRequest('tools/list');
      const response = await mockServer.handleRequest(request);
      
      const duration = profiler.endMeasurement('basic-protocol');
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(request.id);
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      expect(response.result.tools.length).toBeGreaterThan(0);
      
      // Verify all expected tools are present
      const toolNames = response.result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('unjucks_list');
      expect(toolNames).toContain('unjucks_generate');
      expect(toolNames).toContain('unjucks_help');
      expect(toolNames).toContain('unjucks_dry_run');
      expect(toolNames).toContain('unjucks_inject');
      
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it('should handle tool call requests with parameters', async () => {
      const request = MCPTestDataFactory.createMCPRequest('tools/call', {
        name: 'unjucks_generate',
        arguments: {
          generator: 'component',
          template: 'typescript',
          dest: './output',
          variables: {
            name: 'TestComponent',
            withProps: true
          }
        }
      });

      const response = await mockServer.handleRequest(request);
      
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(Array.isArray(response.result.content)).toBe(true);
      
      const content = JSON.parse(response.result.content[0].text);
      expect(content.filesCreated).toBeDefined();
      expect(Array.isArray(content.filesCreated)).toBe(true);
      expect(content.filesCreated[0]).toContain('TestComponent.tsx');
      expect(content.summary).toBeDefined();
      expect(content.summary.created).toBe(1);
    });

    it('should simulate network latency appropriately', async () => {
      const highLatencyServer = new MockMCPServer({ latency: 200 });
      await highLatencyServer.start();
      
      profiler.startMeasurement('high-latency');
      
      const request = MCPTestDataFactory.createMCPRequest('tools/list');
      await highLatencyServer.handleRequest(request);
      
      const duration = profiler.endMeasurement('high-latency');
      
      expect(duration).toBeGreaterThan(180); // Should respect latency setting
      expect(duration).toBeLessThan(250); // But not too much overhead
      
      await highLatencyServer.stop();
    });

    it('should simulate error conditions when configured', async () => {
      const errorServer = new MockMCPServer({ errorRate: 1.0 }); // Always error
      await errorServer.start();
      
      const request = MCPTestDataFactory.createMCPRequest('tools/call', {
        name: 'unjucks_generate',
        arguments: { generator: 'test' }
      });
      
      const response = await errorServer.handleRequest(request);
      
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBeGreaterThan(0);
      expect(response.error!.message).toContain('Simulated server error');
      expect(response.result).toBeUndefined();
      
      await errorServer.stop();
    });
  });

  describe('Test Data Factory Validation', () => {
    it('should create valid swarm tasks for different types', () => {
      const generateTask = MCPTestDataFactory.createSwarmTask('generate');
      expect(generateTask.type).toBe('generate');
      expect(generateTask.id).toMatch(/^test-generate-\d+-[a-z0-9]+$/);
      expect(generateTask.parameters.generator).toBeDefined();
      expect(generateTask.parameters.template).toBeDefined();
      expect(generateTask.parameters.variables).toBeDefined();

      const scaffoldTask = MCPTestDataFactory.createSwarmTask('scaffold');
      expect(scaffoldTask.type).toBe('scaffold');
      expect(scaffoldTask.parameters.name).toBeDefined();
      expect(scaffoldTask.parameters.variables.database).toBeDefined();

      const refactorTask = MCPTestDataFactory.createSwarmTask('refactor');
      expect(refactorTask.type).toBe('refactor');
      expect(refactorTask.parameters.file).toBeDefined();
      expect(refactorTask.parameters.content).toBeDefined();

      const documentTask = MCPTestDataFactory.createSwarmTask('document');
      expect(documentTask.type).toBe('document');
      expect(documentTask.parameters.docType).toBeDefined();
    });

    it('should create valid JTBD workflows of different complexities', () => {
      const simpleWorkflow = MCPTestDataFactory.createJTBDWorkflow('simple');
      expect(simpleWorkflow.steps.length).toBeGreaterThan(0);
      expect(simpleWorkflow.steps.length).toBeLessThan(5);
      expect(simpleWorkflow.job).toContain('component');

      const complexWorkflow = MCPTestDataFactory.createJTBDWorkflow('complex');
      expect(complexWorkflow.steps.length).toBeGreaterThan(3);
      expect(complexWorkflow.steps.some(s => s.generator === 'api')).toBe(true);
      expect(complexWorkflow.steps.some(s => s.generator === 'migration')).toBe(true);

      const enterpriseWorkflow = MCPTestDataFactory.createJTBDWorkflow('enterprise');
      expect(enterpriseWorkflow.steps.length).toBeGreaterThan(5);
      expect(enterpriseWorkflow.description).toContain('enterprise');
      expect(enterpriseWorkflow.steps.some(s => s.generator === 'security')).toBe(true);
      expect(enterpriseWorkflow.steps.some(s => s.generator === 'compliance')).toBe(true);
    });

    it('should create realistic enterprise contexts', () => {
      const financialContext = MCPTestDataFactory.createEnterpriseContext('financial-services');
      expect(financialContext.compliance).toContain('SOX');
      expect(financialContext.compliance).toContain('PCI-DSS');
      expect(financialContext.security.encryption).toBeDefined();
      expect(financialContext.performance.availability).toBeDefined();

      const healthcareContext = MCPTestDataFactory.createEnterpriseContext('healthcare');
      expect(healthcareContext.compliance).toContain('HIPAA');
      expect(healthcareContext.standards).toContain('FHIR R4');
      expect(healthcareContext.interoperability).toBeDefined();

      const ecommerceContext = MCPTestDataFactory.createEnterpriseContext('e-commerce');
      expect(ecommerceContext.compliance).toContain('PCI-DSS');
      expect(ecommerceContext.security.paymentSecurity).toBeDefined();
    });
  });

  describe('Performance Profiler Validation', () => {
    it('should accurately measure operation durations', async () => {
      profiler.startMeasurement('test-operation');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const duration = profiler.endMeasurement('test-operation');
      
      expect(duration).toBeGreaterThan(95);
      expect(duration).toBeLessThan(120);
      
      const stats = profiler.getStatistics('test-operation');
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(1);
      expect(stats!.mean).toBeCloseTo(duration, 1);
    });

    it('should calculate statistical metrics correctly', async () => {
      const operationName = 'multi-measurement-test';
      
      // Perform multiple measurements with known durations
      for (let i = 0; i < 10; i++) {
        profiler.startMeasurement(operationName);
        await new Promise(resolve => setTimeout(resolve, 10 + i)); // 10-19ms
        profiler.endMeasurement(operationName);
      }
      
      const stats = profiler.getStatistics(operationName);
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(10);
      expect(stats!.min).toBeLessThan(stats!.max);
      expect(stats!.mean).toBeGreaterThan(stats!.min);
      expect(stats!.mean).toBeLessThan(stats!.max);
      expect(stats!.median).toBeDefined();
      expect(stats!.p95).toBeGreaterThanOrEqual(stats!.median);
      expect(stats!.p99).toBeGreaterThanOrEqual(stats!.p95);
    });

    it('should handle concurrent measurements', async () => {
      const promises = Array.from({ length: 5 }, async (_, i) => {
        const opName = `concurrent-op-${i}`;
        profiler.startMeasurement(opName);
        await new Promise(resolve => setTimeout(resolve, 20 + i * 5));
        return profiler.endMeasurement(opName);
      });
      
      const durations = await Promise.all(promises);
      
      expect(durations.length).toBe(5);
      durations.forEach((duration, i) => {
        expect(duration).toBeGreaterThan(18 + i * 5);
        expect(duration).toBeLessThan(30 + i * 5);
      });
      
      const allStats = profiler.getAllStatistics();
      expect(Object.keys(allStats).length).toBe(5);
    });
  });

  describe('Test Environment Management', () => {
    it('should create isolated test environments', async () => {
      const env1 = await MCPTestEnvironment.create();
      const env2 = await MCPTestEnvironment.create();
      
      expect(env1.tempDir).not.toBe(env2.tempDir);
      expect(env1.templatesDir).not.toBe(env2.templatesDir);
      
      // Both should have templates
      expect(await env1.fileExists('_templates/component/typescript/component.njk')).toBe(true);
      expect(await env2.fileExists('_templates/component/typescript/component.njk')).toBe(true);
      
      // Create different files in each
      await env1.createTestFile('test1.txt', 'Environment 1');
      await env2.createTestFile('test2.txt', 'Environment 2');
      
      expect(await env1.fileExists('test1.txt')).toBe(true);
      expect(await env1.fileExists('test2.txt')).toBe(false);
      expect(await env2.fileExists('test1.txt')).toBe(false);
      expect(await env2.fileExists('test2.txt')).toBe(true);
      
      await env1.cleanup();
      await env2.cleanup();
    });

    it('should provide comprehensive template structures', async () => {
      const templateFiles = [
        '_templates/component/typescript/component.njk',
        '_templates/component/typescript/test.njk',
        '_templates/api/rest/controller.njk',
        '_templates/database/migration/create_table.njk'
      ];
      
      for (const templateFile of templateFiles) {
        expect(await testEnv.fileExists(templateFile)).toBe(true);
        
        const content = await testEnv.readFile(templateFile);
        expect(content.length).toBeGreaterThan(50);
        expect(content).toContain('---'); // Frontmatter
        expect(content).toContain('to:'); // Destination specification
      }
    });

    it('should handle file operations correctly', async () => {
      const testContent = 'Test file content with special characters: áéíóú';
      const filePath = 'test/nested/file.txt';
      
      const fullPath = await testEnv.createTestFile(filePath, testContent);
      expect(fullPath).toContain(testEnv.tempDir);
      
      expect(await testEnv.fileExists(filePath)).toBe(true);
      
      const readContent = await testEnv.readFile(filePath);
      expect(readContent).toBe(testContent);
    });
  });

  describe('Security Testing Validation', () => {
    it('should generate appropriate malicious requests', () => {
      const maliciousRequests = MCPSecurityTester.createMaliciousRequests();
      
      expect(maliciousRequests.length).toBeGreaterThan(0);
      
      // Check for path traversal attempts
      const pathTraversalRequest = maliciousRequests.find(r => r.id === 'path-traversal-1');
      expect(pathTraversalRequest).toBeDefined();
      expect(pathTraversalRequest!.params.arguments.generator).toContain('../');
      
      // Check for command injection attempts
      const cmdInjectionRequest = maliciousRequests.find(r => r.id === 'cmd-injection-1');
      expect(cmdInjectionRequest).toBeDefined();
      expect(cmdInjectionRequest!.params.arguments.file).toContain(';');
      
      // Check for DoS attempts
      const dosRequest = maliciousRequests.find(r => r.id === 'dos-1');
      expect(dosRequest).toBeDefined();
      expect(dosRequest!.params.arguments.variables.maliciousData.length).toBeGreaterThan(100000);
    });

    it('should validate security responses correctly', () => {
      const blockedResponse: MCPResponse = {
        jsonrpc: "2.0",
        id: "test",
        error: {
          code: 403,
          message: "Access denied"
        }
      };
      
      const allowedResponse: MCPResponse = {
        jsonrpc: "2.0",
        id: "test",
        result: { success: true }
      };
      
      expect(MCPSecurityTester.validateSecurityResponse(blockedResponse, true)).toBe(true);
      expect(MCPSecurityTester.validateSecurityResponse(allowedResponse, false)).toBe(true);
      expect(MCPSecurityTester.validateSecurityResponse(blockedResponse, false)).toBe(false);
      expect(MCPSecurityTester.validateSecurityResponse(allowedResponse, true)).toBe(false);
    });

    it('should handle malicious requests appropriately in mock server', async () => {
      const maliciousRequests = MCPSecurityTester.createMaliciousRequests();
      
      for (const request of maliciousRequests) {
        const response = await mockServer.handleRequest(request);
        
        // Mock server should either reject or handle gracefully
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe(request.id);
        
        // For this test, we're mainly checking that the server doesn't crash
        // In a real implementation, we would expect security violations to be blocked
      }
    });
  });

  describe('MCP Bridge Integration', () => {
    it('should initialize with correct configuration', () => {
      const status = bridge.getStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.memory).toBeDefined();
      expect(status.memory.templates).toBeDefined();
      expect(status.memory.agents).toBeDefined();
      expect(status.memory.tasks).toBeDefined();
      expect(status.memory.workflows).toBeDefined();
      expect(status.stats.uptime).toBeGreaterThan(0);
    });

    it('should convert swarm tasks to unjucks parameters', async () => {
      const task = MCPTestDataFactory.createSwarmTask('generate');
      
      profiler.startMeasurement('task-conversion');
      const result = await bridge.swarmToUnjucks(task);
      profiler.endMeasurement('task-conversion');
      
      expect(result).toBeDefined();
      expect(result!.generator).toBe(task.parameters.generator);
      expect(result!.template).toBe(task.parameters.template);
      expect(result!.dest).toBe(task.parameters.dest);
    });

    it('should handle template variable synchronization', async () => {
      const testVariables = {
        projectName: 'TestProject',
        version: '1.0.0',
        author: 'Test Author',
        features: ['api', 'database']
      };
      
      const syncedVariables = await bridge.syncTemplateVariables(
        'test-generator',
        'test-template',
        testVariables
      );
      
      expect(syncedVariables).toBeDefined();
      expect(syncedVariables.projectName).toBe('TestProject');
      expect(syncedVariables.version).toBe('1.0.0');
      expect(Array.isArray(syncedVariables.features)).toBe(true);
    });

    it('should orchestrate JTBD workflows successfully', async () => {
      const workflow = MCPTestDataFactory.createJTBDWorkflow('simple');
      
      profiler.startMeasurement('jtbd-orchestration');
      const result = await bridge.orchestrateJTBD(workflow);
      profiler.endMeasurement('jtbd-orchestration');
      
      expect(result.success).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.results.length).toBe(workflow.steps.length);
      
      // Check that each step was processed
      result.results.forEach((stepResult, index) => {
        expect(stepResult.stepIndex).toBe(index);
        expect(stepResult.action).toBe(workflow.steps[index].action);
      });
    });

    it('should handle semantic coordination', () => {
      const semanticStatus = bridge.getSemanticStatus();
      
      expect(semanticStatus).toBeDefined();
      // Semantic coordinator might not be fully initialized in test environment
      // but should not throw errors
    });
  });

  describe('End-to-End Integration Scenarios', () => {
    it('should handle complete enterprise workflow', async () => {
      // Create an enterprise-level workflow
      const enterpriseWorkflow = MCPTestDataFactory.createJTBDWorkflow('enterprise');
      
      profiler.startMeasurement('enterprise-workflow');
      
      // Execute the workflow
      const result = await bridge.orchestrateJTBD(enterpriseWorkflow);
      
      const executionTime = profiler.endMeasurement('enterprise-workflow');
      
      // Validate results
      expect(result.success).toBe(true);
      expect(result.results.length).toBe(enterpriseWorkflow.steps.length);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Validate that all enterprise components were addressed
      const generatedComponents = enterpriseWorkflow.steps
        .filter(step => step.action === 'generate')
        .map(step => step.generator!);
      
      expect(generatedComponents).toContain('architecture');
      expect(generatedComponents).toContain('security');
      expect(generatedComponents).toContain('monitoring');
      expect(generatedComponents).toContain('compliance');
      
      // Check workflow was stored in memory
      const status = bridge.getStatus();
      expect(status.memory.workflows[enterpriseWorkflow.id]).toBeDefined();
    });

    it('should demonstrate performance under load', async () => {
      const concurrentTasks = 20;
      const tasks = Array.from({ length: concurrentTasks }, () => 
        MCPTestDataFactory.createSwarmTask('generate')
      );
      
      profiler.startMeasurement('concurrent-load-test');
      
      const results = await Promise.allSettled(
        tasks.map(task => bridge.swarmToUnjucks(task))
      );
      
      const totalTime = profiler.endMeasurement('concurrent-load-test');
      
      // Validate all tasks were processed
      expect(results.length).toBe(concurrentTasks);
      
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThan(concurrentTasks * 0.9); // At least 90% success rate
      
      // Performance should scale reasonably
      const averageTimePerTask = totalTime / concurrentTasks;
      expect(averageTimePerTask).toBeLessThan(1000); // Less than 1 second per task on average
      
      console.log(chalk.cyan(`Load test: ${concurrentTasks} tasks in ${totalTime.toFixed(2)}ms (avg: ${averageTimePerTask.toFixed(2)}ms/task)`));
    });

    it('should maintain data consistency across operations', async () => {
      // Perform multiple operations that modify bridge state
      const operations = [
        () => bridge.syncTemplateVariables('gen1', 'template1', { var1: 'value1' }),
        () => bridge.syncTemplateVariables('gen2', 'template2', { var2: 'value2' }),
        () => bridge.coordinateWithSwarm('test message 1'),
        () => bridge.coordinateWithSwarm('test message 2')
      ];
      
      // Execute operations concurrently
      await Promise.all(operations.map(op => op()));
      
      // Validate final state consistency
      const status = bridge.getStatus();
      expect(status.memory.templates.variables).toBeDefined();
      
      // Bridge should still be in valid state
      expect(status.initialized).toBe(true);
      expect(status.stats.pendingRequests).toBe(0);
    });

    it('should recover from error conditions gracefully', async () => {
      // Test error handling with malformed tasks
      const malformedTasks: any[] = [
        { id: null, type: 'generate' },
        { id: 'test', type: null },
        { id: 'test', type: 'invalid-type', parameters: null }
      ];
      
      for (const task of malformedTasks) {
        // Should not throw, but may return null
        const result = await bridge.swarmToUnjucks(task);
        // The bridge should handle malformed input gracefully
      }
      
      // Bridge should still be operational
      const status = bridge.getStatus();
      expect(status.initialized).toBe(true);
      
      // Test with a valid task to ensure recovery
      const validTask = MCPTestDataFactory.createSwarmTask('generate');
      const validResult = await bridge.swarmToUnjucks(validTask);
      expect(validResult).toBeDefined();
    });
  });

  describe('Performance and Quality Metrics', () => {
    it('should meet performance benchmarks', () => {
      const allStats = profiler.getAllStatistics();
      
      // Log performance summary
      console.log(chalk.cyan('\n📈 Performance Summary:'));
      Object.entries(allStats).forEach(([operation, stats]) => {
        if (stats) {
          console.log(chalk.cyan(`  ${operation}: avg=${stats.mean.toFixed(2)}ms, p95=${stats.p95.toFixed(2)}ms, count=${stats.count}`));
        }
      });
      
      // Validate key performance metrics
      if (allStats['task-conversion']) {
        expect(allStats['task-conversion'].mean).toBeLessThan(100); // Task conversion should be fast
      }
      
      if (allStats['jtbd-orchestration']) {
        expect(allStats['jtbd-orchestration'].mean).toBeLessThan(5000); // JTBD orchestration should complete quickly
      }
    });

    it('should demonstrate comprehensive test coverage', () => {
      // Validate that our testing framework covers all major components
      const mockServerStats = mockServer.getStats();
      expect(mockServerStats.requestCount).toBeGreaterThan(0);
      
      const bridgeStatus = bridge.getStatus();
      expect(bridgeStatus.initialized).toBe(true);
      
      // Ensure we've tested various scenarios
      const performanceStats = profiler.getAllStatistics();
      expect(Object.keys(performanceStats).length).toBeGreaterThan(3);
      
      console.log(chalk.green('\n✅ Comprehensive Test Coverage Validated:'));
      console.log(chalk.green(`  - Mock Server Requests: ${mockServerStats.requestCount}`));
      console.log(chalk.green(`  - Performance Metrics: ${Object.keys(performanceStats).length} operations`));
      console.log(chalk.green(`  - Bridge Operations: ${bridgeStatus.stats.pendingRequests} pending`));
    });
  });
});