#!/usr/bin/env node

/**
 * Basic test runner for foundational Unjucks v3 components
 * Runs without complex testing frameworks to validate core structure
 */

import { performance } from 'perf_hooks';
import { CONSTANTS, getEnvironmentConfig, validateSystemRequirements } from '../src/utils/constants.js';
import { Logger } from '../src/utils/logger.js';
import { PerformanceMonitor } from '../src/utils/performance-monitor.js';

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🚀 Running Unjucks v3 Foundation Tests\n');
    
    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✅ ${test.name}`);
        this.results.passed++;
      } catch (error) {
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${error.message}`);
        this.results.failed++;
      }
      this.results.total++;
    }

    console.log(`\n📊 Test Results:`);
    console.log(`   Passed: ${this.results.passed}`);
    console.log(`   Failed: ${this.results.failed}`);
    console.log(`   Total:  ${this.results.total}`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Some tests failed');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
    }
  }
}

// Create test runner
const runner = new TestRunner();

// Test Constants
runner.test('Constants should have required properties', () => {
  if (CONSTANTS.APP_NAME !== 'unjucks') {
    throw new Error(`Expected APP_NAME to be 'unjucks', got '${CONSTANTS.APP_NAME}'`);
  }
  
  if (CONSTANTS.VERSION !== '3.0.0') {
    throw new Error(`Expected VERSION to be '3.0.0', got '${CONSTANTS.VERSION}'`);
  }

  if (!CONSTANTS.DESCRIPTION.includes('template scaffolding')) {
    throw new Error('DESCRIPTION should contain "template scaffolding"');
  }
});

runner.test('Constants should have proper file extensions', () => {
  if (!CONSTANTS.TEMPLATE_EXTENSIONS.includes('.njk')) {
    throw new Error('TEMPLATE_EXTENSIONS should include .njk');
  }
  
  if (!CONSTANTS.RDF_FILE_EXTENSIONS.includes('.ttl')) {
    throw new Error('RDF_FILE_EXTENSIONS should include .ttl');
  }
});

runner.test('Environment config should work', () => {
  const devConfig = getEnvironmentConfig('development');
  if (devConfig.LOG_LEVEL !== 'debug') {
    throw new Error(`Expected dev LOG_LEVEL to be 'debug', got '${devConfig.LOG_LEVEL}'`);
  }
  
  const prodConfig = getEnvironmentConfig('production');
  if (prodConfig.LOG_LEVEL !== 'info') {
    throw new Error(`Expected prod LOG_LEVEL to be 'info', got '${prodConfig.LOG_LEVEL}'`);
  }
});

runner.test('System validation should work', () => {
  const validation = validateSystemRequirements();
  if (typeof validation.valid !== 'boolean') {
    throw new Error('System validation should return valid boolean');
  }
  
  if (!Array.isArray(validation.issues)) {
    throw new Error('System validation should return issues array');
  }
  
  if (!validation.system || !validation.system.nodeVersion) {
    throw new Error('System validation should return system info');
  }
});

// Test Logger
runner.test('Logger should initialize with defaults', () => {
  const logger = new Logger();
  if (logger.config.level !== 'info') {
    throw new Error(`Expected default level to be 'info', got '${logger.config.level}'`);
  }
  
  if (logger.config.timestamps !== true) {
    throw new Error('Expected timestamps to be true by default');
  }
});

runner.test('Logger should respect log levels', () => {
  const logger = new Logger({ level: 'error' });
  if (!logger.shouldLog('error')) {
    throw new Error('Error level should be allowed');
  }
  
  if (logger.shouldLog('debug')) {
    throw new Error('Debug level should not be allowed when level is error');
  }
});

runner.test('Logger should handle timing operations', () => {
  const logger = new Logger({ level: 'debug' });
  
  logger.startTimer('test-op');
  // Simulate some work
  for (let i = 0; i < 1000; i++) {
    Math.random();
  }
  const duration = logger.endTimer('test-op');
  
  if (typeof duration !== 'number' || duration < 0) {
    throw new Error('Timer should return a positive number');
  }
});

runner.test('Logger should create child loggers', () => {
  const parent = new Logger({ prefix: 'parent' });
  const child = parent.child('child');
  
  if (child.config.prefix !== 'parent:child') {
    throw new Error(`Expected child prefix to be 'parent:child', got '${child.config.prefix}'`);
  }
});

// Test PerformanceMonitor
runner.test('PerformanceMonitor should initialize', () => {
  const monitor = new PerformanceMonitor({ enabled: true });
  if (!monitor.config.enabled) {
    throw new Error('Monitor should be enabled');
  }
  
  if (monitor.config.sampleRate !== 1.0) {
    throw new Error('Default sample rate should be 1.0');
  }
  
  monitor.cleanup();
});

runner.test('PerformanceMonitor should track operations', () => {
  const monitor = new PerformanceMonitor({ enabled: true });
  
  const timerId = monitor.startOperation('test-op');
  if (!timerId) {
    throw new Error('Should return timer ID');
  }
  
  if (monitor.getActiveOperationsCount() !== 1) {
    throw new Error('Should have 1 active operation');
  }
  
  const metrics = monitor.endOperation(timerId);
  if (!metrics || metrics.operationId !== 'test-op') {
    throw new Error('Should return metrics with correct operation ID');
  }
  
  if (monitor.getActiveOperationsCount() !== 0) {
    throw new Error('Should have 0 active operations after ending');
  }
  
  monitor.cleanup();
});

runner.test('PerformanceMonitor should generate reports', () => {
  const monitor = new PerformanceMonitor({ enabled: true });
  
  monitor.recordOperation('test-op', 100);
  monitor.recordError('test-op', 'TEST_ERROR');
  
  const report = monitor.generateReport();
  
  if (!report.summary || !report.operations || !report.errors || !report.system) {
    throw new Error('Report should have required sections');
  }
  
  if (report.summary.totalOperations !== 1) {
    throw new Error('Should record 1 operation');
  }
  
  if (report.summary.totalErrors !== 1) {
    throw new Error('Should record 1 error');
  }
  
  monitor.cleanup();
});

runner.test('PerformanceMonitor should provide insights', () => {
  const monitor = new PerformanceMonitor({ enabled: true });
  
  monitor.recordOperation('slow-op', 2000); // Slow operation
  monitor.recordError('failing-op', 'ERROR');
  
  const insights = monitor.getInsights();
  
  if (!insights.recommendations || !insights.warnings || !insights.highlights) {
    throw new Error('Insights should have required sections');
  }
  
  monitor.cleanup();
});

// Run all tests
runner.run().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});