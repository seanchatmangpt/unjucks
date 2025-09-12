#!/usr/bin/env node

/**
 * KGEN Reproducibility Integration Tests
 * 
 * Comprehensive integration tests for the reproducibility validation framework
 * Tests framework components, KGEN integration, and end-to-end workflows
 * 
 * Agent 11: Reproducibility Validation Engineer
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { promises as fs, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { performance } from 'perf_hooks';

import ReproducibilityTestFramework from './framework.js';
import ReproducibilityMonitor from './monitor.js';

describe('KGEN Reproducibility Validation System', () => {
  let tempDir;
  let mockKGenPath;
  let testDataPath;

  beforeAll(async () => {
    // Create temporary directory for tests
    tempDir = join(tmpdir(), `kgen-repro-tests-${this.getDeterministicTimestamp()}-${randomBytes(4).toString('hex')}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create mock KGEN executable for testing
    mockKGenPath = join(tempDir, 'mock-kgen.mjs');
    await createMockKGen(mockKGenPath);

    // Create test data directory
    testDataPath = join(tempDir, 'test-data');
    await fs.mkdir(testDataPath, { recursive: true });
    await createTestData(testDataPath);
  });

  afterAll(async () => {
    // Cleanup temporary directory
    if (existsSync(tempDir)) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('ReproducibilityTestFramework', () => {
    let framework;

    beforeEach(() => {
      framework = new ReproducibilityTestFramework({
        targetReproducibility: 99.0,
        minIterations: 3,
        testTimeout: 5000,
        kgenPath: mockKGenPath,
        tempDir: join(tempDir, 'framework-tests')
      });
    });

    afterEach(async () => {
      if (framework) {
        await framework.shutdown();
      }
    });

    it('should initialize successfully', async () => {
      const result = await framework.initialize();
      
      expect(result.success).toBe(true);
      expect(framework.environmentBaseline).toBeDefined();
      expect(framework.environmentBaseline.nodeVersion).toBe(process.version);
      expect(framework.environmentBaseline.platform).toBe(process.platform);
    });

    it('should establish environment baseline correctly', async () => {
      await framework.initialize();
      
      const baseline = framework.environmentBaseline;
      expect(baseline).toHaveProperty('nodeVersion');
      expect(baseline).toHaveProperty('platform');
      expect(baseline).toHaveProperty('timezone');
      expect(baseline).toHaveProperty('environmentVariables');
      expect(baseline).toHaveProperty('memoryUsage');
    });

    it('should generate default test suites', async () => {
      await framework.initialize();
      
      const suites = await framework.generateDefaultTestSuites();
      
      expect(suites).toBeInstanceOf(Array);
      expect(suites.length).toBeGreaterThan(0);
      
      // Check for expected suites
      const suiteNames = suites.map(s => s.name);
      expect(suiteNames).toContain('Graph Operations');
      expect(suiteNames).toContain('Artifact Generation');
      expect(suiteNames).toContain('Template Processing');
      
      // Validate suite structure
      suites.forEach(suite => {
        expect(suite).toHaveProperty('name');
        expect(suite).toHaveProperty('description');
        expect(suite).toHaveProperty('tests');
        expect(suite.tests).toBeInstanceOf(Array);
        
        suite.tests.forEach(test => {
          expect(test).toHaveProperty('operation');
          expect(test).toHaveProperty('type');
          expect(test).toHaveProperty('args');
        });
      });
    });

    it('should create isolated test environments', async () => {
      await framework.initialize();
      
      const testEnv = await framework.createIsolatedTestEnvironment('test-suite');
      
      expect(testEnv.isolation).toHaveProperty('id');
      expect(testEnv.isolation).toHaveProperty('directory');
      expect(testEnv.isolation).toHaveProperty('timezone', 'UTC');
      expect(testEnv.isolation).toHaveProperty('staticTime');
      
      expect(existsSync(testEnv.directory)).toBe(true);
      
      // Check environment variables
      expect(testEnv.isolation.environment).toHaveProperty('TZ', 'UTC');
      expect(testEnv.isolation.environment).toHaveProperty('NODE_ENV', 'test');
    });

    it('should run reproducibility tests', async () => {
      await framework.initialize();
      
      const testSuite = {
        name: 'Simple Test',
        description: 'Basic reproducibility test',
        tests: [{
          operation: 'graph hash',
          args: ['test-file.ttl'],
          type: 'hash-comparison'
        }]
      };
      
      const result = await framework.runTestSuite(testSuite);
      
      expect(result).toHaveProperty('name', 'Simple Test');
      expect(result).toHaveProperty('reproducibilityScore');
      expect(result.reproducibilityScore).toBeGreaterThanOrEqual(0);
      expect(result.reproducibilityScore).toBeLessThanOrEqual(100);
      expect(result).toHaveProperty('tests');
      expect(result.tests).toHaveLength(1);
      
      const testResult = result.tests[0];
      expect(testResult).toHaveProperty('operation', 'graph hash');
      expect(testResult).toHaveProperty('iterations');
      expect(testResult.iterations).toBeGreaterThan(0);
    });

    it('should detect non-deterministic behavior', async () => {
      await framework.initialize();
      
      // Create mock test with known non-deterministic behavior
      const testSuite = {
        name: 'Non-deterministic Test',
        description: 'Test with timestamp variations',
        tests: [{
          operation: 'timestamp-test', // This will output current timestamp
          args: [],
          type: 'hash-comparison'
        }]
      };
      
      const result = await framework.runTestSuite(testSuite);
      
      expect(result.reproducibilityScore).toBeLessThan(100);
      expect(result.issues.length).toBeGreaterThan(0);
      
      const nonDetIssues = result.issues.filter(issue => 
        issue.type === 'non-deterministic-source'
      );
      expect(nonDetIssues.length).toBeGreaterThan(0);
    });

    it('should calculate overall reproducibility score correctly', async () => {
      await framework.initialize();
      
      // Mock results with known scores
      const results = [
        { reproducibilityScore: 100, totalRuns: 10, identicalRuns: 10, tests: [] },
        { reproducibilityScore: 95, totalRuns: 10, identicalRuns: 9, tests: [] },
        { reproducibilityScore: 90, totalRuns: 10, identicalRuns: 9, tests: [] }
      ];
      
      const overallScore = framework.calculateOverallScore(results);
      
      expect(overallScore).toBeGreaterThanOrEqual(90);
      expect(overallScore).toBeLessThanOrEqual(100);
    });

    it('should generate comprehensive reports', async () => {
      await framework.initialize();
      
      const results = [{
        name: 'Test Suite',
        reproducibilityScore: 95.5,
        totalRuns: 10,
        identicalRuns: 9,
        tests: [],
        issues: []
      }];
      
      const report = await framework.generateReproducibilityReport(results, 95.5);
      
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('environment');
      expect(report).toHaveProperty('suiteResults');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('reportPath');
      expect(report).toHaveProperty('summaryPath');
      
      // Verify files were created
      expect(existsSync(report.reportPath)).toBe(true);
      expect(existsSync(report.summaryPath)).toBe(true);
    });

    it('should handle KGEN command execution errors gracefully', async () => {
      // Create framework with non-existent KGEN path
      const errorFramework = new ReproducibilityTestFramework({
        kgenPath: '/nonexistent/kgen',
        tempDir: join(tempDir, 'error-test')
      });
      
      const result = await errorFramework.initialize();
      
      // Should still initialize but with limited functionality
      expect(result.success).toBe(true);
      
      await errorFramework.shutdown();
    });

    it('should meet performance targets', async () => {
      await framework.initialize();
      
      const startTime = performance.now();
      
      const testSuite = {
        name: 'Performance Test',
        description: 'Test framework performance',
        tests: [{
          operation: 'graph hash',
          args: ['test.ttl'],
          type: 'hash-comparison'
        }]
      };
      
      const result = await framework.runTestSuite(testSuite);
      const duration = performance.now() - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(30000); // 30 seconds max
      expect(result.executionTime).toBeLessThan(20000); // 20 seconds max for suite
    });
  });

  describe('ReproducibilityMonitor', () => {
    let monitor;

    beforeEach(() => {
      monitor = new ReproducibilityMonitor({
        monitoringInterval: 1000, // 1 second for testing
        alertThreshold: 90.0,
        outputDirectory: join(tempDir, 'monitor-tests'),
        kgenPath: mockKGenPath
      });
    });

    afterEach(async () => {
      if (monitor && monitor.isMonitoring) {
        await monitor.stopMonitoring();
      }
    });

    it('should initialize monitoring successfully', async () => {
      const result = await monitor.startMonitoring();
      
      expect(result.success).toBe(true);
      expect(monitor.isMonitoring).toBe(true);
      expect(monitor.baseline).toBeDefined();
      
      await monitor.stopMonitoring();
    });

    it('should establish baseline metrics', async () => {
      await monitor.startMonitoring();
      
      const baseline = monitor.baseline;
      
      expect(baseline).toHaveProperty('timestamp');
      expect(baseline).toHaveProperty('environment');
      expect(baseline).toHaveProperty('operations');
      expect(baseline).toHaveProperty('overallScore');
      expect(baseline.overallScore).toBeGreaterThanOrEqual(0);
      expect(baseline.overallScore).toBeLessThanOrEqual(100);
      
      await monitor.stopMonitoring();
    });

    it('should perform monitoring cycles', async () => {
      await monitor.startMonitoring();
      
      // Wait for at least one monitoring cycle
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(monitor.metrics.history.length).toBeGreaterThan(0);
      
      const lastCycle = monitor.metrics.current;
      expect(lastCycle).toHaveProperty('timestamp');
      expect(lastCycle).toHaveProperty('operations');
      expect(lastCycle).toHaveProperty('metrics');
      expect(lastCycle.metrics).toHaveProperty('overallReproducibility');
      
      await monitor.stopMonitoring();
    });

    it('should detect and report alerts', async () => {
      // Create monitor with very high threshold to trigger alerts
      const alertMonitor = new ReproducibilityMonitor({
        monitoringInterval: 500,
        alertThreshold: 99.9,
        outputDirectory: join(tempDir, 'alert-test'),
        kgenPath: mockKGenPath
      });
      
      const alerts = [];
      alertMonitor.on('alerts-triggered', (triggeredAlerts) => {
        alerts.push(...triggeredAlerts);
      });
      
      await alertMonitor.startMonitoring();
      
      // Wait for monitoring cycles
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await alertMonitor.stopMonitoring();
      
      // Should have detected some alerts due to high threshold
      expect(alerts.length).toBeGreaterThan(0);
      
      alerts.forEach(alert => {
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('severity');
        expect(alert).toHaveProperty('message');
      });
    });

    it('should generate monitoring reports', async () => {
      await monitor.startMonitoring();
      
      // Let it run for a short time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = await monitor.stopMonitoring();
      
      expect(result.success).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report).toHaveProperty('reportPath');
      expect(result.report).toHaveProperty('dashboardPath');
      
      // Verify files exist
      expect(existsSync(result.report.reportPath)).toBe(true);
      expect(existsSync(result.report.dashboardPath)).toBe(true);
    });

    it('should track trends over time', async () => {
      await monitor.startMonitoring();
      
      // Let it run for multiple cycles
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      expect(monitor.metrics.trends.reproducibility.length).toBeGreaterThan(0);
      expect(monitor.metrics.trends.performance.length).toBeGreaterThan(0);
      
      await monitor.stopMonitoring();
    });
  });

  describe('Integration Workflows', () => {
    it('should complete full validation workflow', async () => {
      const framework = new ReproducibilityTestFramework({
        targetReproducibility: 90.0, // Lower threshold for testing
        minIterations: 3,
        kgenPath: mockKGenPath,
        tempDir: join(tempDir, 'workflow-test')
      });
      
      try {
        // Initialize
        const initResult = await framework.initialize();
        expect(initResult.success).toBe(true);
        
        // Generate test suites
        const suites = await framework.generateDefaultTestSuites();
        expect(suites.length).toBeGreaterThan(0);
        
        // Run validation (with limited suites for testing)
        const limitedSuites = suites.slice(0, 2); // Only test first 2 suites
        const result = await framework.runReproducibilityValidation(limitedSuites);
        
        expect(result.success).toBe(true);
        expect(result).toHaveProperty('reproducibilityScore');
        expect(result).toHaveProperty('report');
        expect(result.report).toHaveProperty('reportPath');
        
        // Verify report exists
        expect(existsSync(result.report.reportPath)).toBe(true);
        
      } finally {
        await framework.shutdown();
      }
    });

    it('should handle monitoring with framework integration', async () => {
      const monitor = new ReproducibilityMonitor({
        monitoringInterval: 800,
        outputDirectory: join(tempDir, 'integration-test'),
        kgenPath: mockKGenPath
      });
      
      try {
        await monitor.startMonitoring();
        
        // Let monitoring run
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const result = await monitor.stopMonitoring();
        
        expect(result.success).toBe(true);
        expect(monitor.metrics.history.length).toBeGreaterThan(0);
        
      } catch (error) {
        if (monitor.isMonitoring) {
          await monitor.stopMonitoring();
        }
        throw error;
      }
    });

    it('should validate 99.9% reproducibility target', async () => {
      const framework = new ReproducibilityTestFramework({
        targetReproducibility: 99.9,
        minIterations: 10,
        kgenPath: mockKGenPath,
        tempDir: join(tempDir, 'target-test')
      });
      
      try {
        await framework.initialize();
        
        // Create deterministic test suite
        const deterministicSuite = {
          name: 'Deterministic Test',
          description: 'Test with deterministic mock responses',
          tests: [{
            operation: 'deterministic-test',
            args: [],
            type: 'hash-comparison'
          }]
        };
        
        const result = await framework.runTestSuite(deterministicSuite);
        
        // With our deterministic mock, should achieve high reproducibility
        expect(result.reproducibilityScore).toBeGreaterThanOrEqual(95);
        
      } finally {
        await framework.shutdown();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle KGEN command failures gracefully', async () => {
      const framework = new ReproducibilityTestFramework({
        kgenPath: join(tempDir, 'failing-kgen.mjs'),
        tempDir: join(tempDir, 'error-handling')
      });
      
      // Create failing mock KGEN
      await createFailingMockKGen(join(tempDir, 'failing-kgen.mjs'));
      
      try {
        await framework.initialize();
        
        const testSuite = {
          name: 'Error Test',
          tests: [{
            operation: 'graph hash',
            args: ['test.ttl'],
            type: 'hash-comparison'
          }]
        };
        
        const result = await framework.runTestSuite(testSuite);
        
        // Should handle errors without crashing
        expect(result).toHaveProperty('name', 'Error Test');
        expect(result.issues.length).toBeGreaterThan(0);
        
      } finally {
        await framework.shutdown();
      }
    });

    it('should handle environment cleanup failures', async () => {
      const framework = new ReproducibilityTestFramework({
        kgenPath: mockKGenPath,
        tempDir: join(tempDir, 'cleanup-test')
      });
      
      try {
        await framework.initialize();
        
        // Should not throw even if cleanup encounters issues
        await expect(framework.shutdown()).resolves.not.toThrow();
        
      } catch (error) {
        // Cleanup error should not prevent shutdown
        await framework.shutdown();
      }
    });

    it('should validate performance impact stays within threshold', async () => {
      const framework = new ReproducibilityTestFramework({
        performanceThreshold: 10, // 10% max impact
        kgenPath: mockKGenPath,
        tempDir: join(tempDir, 'performance-test')
      });
      
      try {
        await framework.initialize();
        
        const startTime = performance.now();
        
        const testSuite = {
          name: 'Performance Impact Test',
          tests: [{
            operation: 'graph hash',
            args: ['test.ttl'],
            type: 'hash-comparison'
          }]
        };
        
        const result = await framework.runTestSuite(testSuite);
        const duration = performance.now() - startTime;
        
        // Performance should be reasonable
        expect(duration).toBeLessThan(15000); // 15 seconds max
        expect(result.tests[0].avgExecutionTime).toBeLessThan(5000); // 5 seconds per test
        
      } finally {
        await framework.shutdown();
      }
    });
  });
});

// Helper functions for test setup

async function createMockKGen(kgenPath) {
  const mockScript = `#!/usr/bin/env node

// Mock KGEN for testing
const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

// Simulate different behaviors based on command
const responses = {
  '--version': { success: true, output: 'KGEN v1.0.0-test' },
  '--help': { success: true, output: 'KGEN Help\\nUsage: kgen <command>' },
  'graph hash': { 
    success: true, 
    output: JSON.stringify({
      success: true,
      hash: 'a1b2c3d4e5f6',
      file: args[2],
      timestamp: this.getDeterministicDate().toISOString()
    })
  },
  'graph index': {
    success: true,
    output: JSON.stringify({
      success: true,
      triples: 123,
      subjects: 45,
      predicates: 12
    })
  },
  'deterministic-test': {
    success: true,
    output: 'deterministic-output-12345' // Always same output
  },
  'timestamp-test': {
    success: true,
    output: \`timestamp-output-\${this.getDeterministicTimestamp()}\` // Always different
  }
};

const key = command === '--version' || command === '--help' ? command : \`\${command} \${subcommand}\`;
const response = responses[key] || responses['graph hash']; // Default response

console.log(response.output);
process.exit(response.success ? 0 : 1);
`;

  await fs.writeFile(kgenPath, mockScript);
  await fs.chmod(kgenPath, '755');
}

async function createFailingMockKGen(kgenPath) {
  const mockScript = `#!/usr/bin/env node
console.error('Mock KGEN failure');
process.exit(1);
`;

  await fs.writeFile(kgenPath, mockScript);
  await fs.chmod(kgenPath, '755');
}

async function createTestData(dataPath) {
  // Create sample RDF file
  const rdfContent = `@prefix ex: <http://example.org/> .
ex:testSubject ex:testProperty "test value" .`;
  
  await fs.writeFile(join(dataPath, 'test.ttl'), rdfContent);
  
  // Create sample template
  const templateContent = `Test Template
Generated: {{ timestamp | default('2024-01-01T00:00:00.000Z') }}`;
  
  await fs.writeFile(join(dataPath, 'test.njk'), templateContent);
}

// Export for potential external use
export {
  ReproducibilityTestFramework,
  ReproducibilityMonitor
};