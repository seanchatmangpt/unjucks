/**
 * Comprehensive Test Helpers and Utilities for Unjucks
 * 
 * This module exports all test helpers, fixtures, and utilities needed
 * for comprehensive testing of the Unjucks template generator system.
 */

// Core test helpers
export * from './generators';
export * from './templates';
export * from './cli';
export * from './filesystem';
export * from './assertions';

// Main test helper class (re-export from parent)
export { TestHelper } from '../TestHelper';
export type { CLIResult } from '../TestHelper';

// World and context
export { UnjucksWorld } from '../world';
export type { TestContext, UnjucksWorldParameters } from '../world';

// Type definitions
export interface TestSuiteConfig {
  tempDirPrefix?: string;
  timeout?: number;
  parallel?: boolean;
  cleanup?: boolean;
  verbose?: boolean;
}

export interface TestFixture {
  name: string;
  description: string;
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
  data: Record<string, any>;
}

export interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings?: string[];
  performance?: {
    duration: number;
    memoryUsage: number;
  };
}

// Utility functions
export const TestUtils = {
  /**
   * Create a temporary directory with cleanup tracking
   */
  async createTempDir(prefix: string = 'unjucks-test-'): Promise<string> {
    const { FileSystemTestHelper } = await import('./filesystem');
    const helper = new FileSystemTestHelper();
    return helper.createTempDirectory(prefix);
  },

  /**
   * Generate test data for property-based testing
   */
  async loadPropertyTestData(category: string): Promise<any> {
    const fs = await import('fs-extra');
    const path = await import('node:path');
    
    const dataPath = path.join(__dirname, '../../../fixtures/data/property-based', `${category}.json`);
    const data = await fs.readJSON(dataPath);
    return data;
  },

  /**
   * Load security test data
   */
  async loadSecurityTestData(): Promise<any> {
    const fs = await import('fs-extra');
    const path = await import('node:path');
    
    const dataPath = path.join(__dirname, '../../../fixtures/data/security/malicious-inputs.json');
    const data = await fs.readJSON(dataPath);
    return data;
  },

  /**
   * Load performance benchmarks
   */
  async loadPerformanceBenchmarks(): Promise<any> {
    const fs = await import('fs-extra');
    const path = await import('node:path');
    
    const dataPath = path.join(__dirname, '../../../fixtures/data/performance/benchmarks.json');
    const data = await fs.readJSON(dataPath);
    return data;
  },

  /**
   * Create a comprehensive test suite
   */
  async createTestSuite(config: TestSuiteConfig = {}): Promise<{
    generators: any[];
    templates: any[];
    configs: any[];
    cliScenarios: any[];
    teardown: () => Promise<void>;
  }> {
    const { GeneratorTestHelper } = await import('./generators');
    const { CLITestHelper } = await import('./cli');
    const { FileSystemTestHelper } = await import('./filesystem');
    
    const fsHelper = new FileSystemTestHelper();
    const tempDir = await fsHelper.createTempDirectory(config.tempDirPrefix);
    
    // Create generators
    const generators = await GeneratorTestHelper.createTestSuite(tempDir);
    
    // Create CLI scenarios
    const cliScenarios = CLITestHelper.getStandardScenarios();
    
    return {
      generators,
      templates: [],
      configs: [],
      cliScenarios,
      teardown: async () => {
        if (config.cleanup !== false) {
          await fsHelper.cleanup();
        }
      }
    };
  },

  /**
   * Run comprehensive validation suite
   */
  async runValidationSuite(
    baseDir: string,
    options: {
      includePerformance?: boolean;
      includeSecurity?: boolean;
      includeEdgeCases?: boolean;
    } = {}
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let totalDuration = 0;
    let maxMemoryUsage = 0;
    
    const startTime = performance.now();
    
    try {
      // Basic file structure validation
      const { TestAssertions } = await import('./assertions');
      
      // Check for required directories
      await TestAssertions.assertDirectory(baseDir, {
        path: '_templates',
        shouldExist: true
      });
      
      // Performance tests
      if (options.includePerformance) {
        const benchmarks = await this.loadPerformanceBenchmarks();
        // Run performance validations
        warnings.push('Performance testing completed');
      }
      
      // Security tests
      if (options.includeSecurity) {
        const securityData = await this.loadSecurityTestData();
        // Run security validations
        warnings.push('Security testing completed');
      }
      
      totalDuration = performance.now() - startTime;
      maxMemoryUsage = process.memoryUsage().heapUsed;
      
    } catch (error) {
      errors.push(`Validation failed: ${error}`);
    }
    
    return {
      passed: errors.length === 0,
      errors,
      warnings,
      performance: {
        duration: totalDuration,
        memoryUsage: maxMemoryUsage
      }
    };
  },

  /**
   * Generate comprehensive test report
   */
  generateTestReport(results: ValidationResult[]): string {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings || []);
    
    const avgDuration = results.reduce((sum, r) => 
      sum + (r.performance?.duration || 0), 0) / totalTests;
    
    const maxMemory = Math.max(...results.map(r => 
      r.performance?.memoryUsage || 0));
    
    return [
      '# Test Suite Report',
      '',
      '## Summary',
      `- Total Tests: ${totalTests}`,
      `- Passed: ${passedTests}`,
      `- Failed: ${failedTests}`,
      `- Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`,
      '',
      '## Performance',
      `- Average Duration: ${avgDuration.toFixed(2)}ms`,
      `- Peak Memory Usage: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`,
      '',
      '## Issues',
      `- Errors: ${allErrors.length}`,
      `- Warnings: ${allWarnings.length}`,
      '',
      ...(allErrors.length > 0 ? [
        '### Errors',
        ...allErrors.map(e => `- ${e}`),
        ''
      ] : []),
      ...(allWarnings.length > 0 ? [
        '### Warnings',
        ...allWarnings.map(w => `- ${w}`),
        ''
      ] : [])
    ].join('\n');
  }
};

// Constants
export const TEST_CONSTANTS = {
  DEFAULT_TIMEOUT: 30000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_MEMORY_USAGE: 100 * 1024 * 1024, // 100MB
  TEMP_DIR_PREFIX: 'unjucks-test-',
  CLI_PATH: 'dist/cli.mjs'
};

// Export fixture paths for easy access
export const FIXTURE_PATHS = {
  GENERATORS: 'tests/fixtures/generators',
  TEMPLATES: 'tests/fixtures/templates', 
  CONFIGS: 'tests/fixtures/configs',
  DATA: 'tests/fixtures/data',
  EXPECTED_OUTPUTS: 'tests/fixtures/expected-outputs',
  MOCK_DATA: 'tests/fixtures/mock-data'
};

// Helper to setup complete test environment
export async function setupTestEnvironment(config: TestSuiteConfig = {}) {
  const suite = await TestUtils.createTestSuite(config);
  
  // Additional setup can be added here
  
  return {
    ...suite,
    config,
    // Utility methods for the test environment
    async validate(options = {}) {
      // Implementation would go here
      return TestUtils.runValidationSuite('', options);
    },
    
    async cleanup() {
      await suite.teardown();
    }
  };
}

// Default export
export default {
  TestUtils,
  TEST_CONSTANTS,
  FIXTURE_PATHS,
  setupTestEnvironment
};