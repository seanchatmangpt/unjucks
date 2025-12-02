/**
 * Cucumber Configuration for CAS Engine BDD Testing
 * 
 * This configuration sets up Cucumber.js for testing the Content-Addressed Storage
 * engine with proper TypeScript support, step definitions, and reporting.
 */

import { defineConfig } from '@cucumber/cucumber';

export default defineConfig({
  // Feature files location
  paths: ['features/**/*.feature'],
  
  // Step definitions and support files
  import: [
    'features/step_definitions/**/*.ts',
    'features/fixtures/**/*.ts',
    'features/support/**/*.ts'
  ],

  // Require configuration for TypeScript
  requireModule: ['ts-node/register'],

  // Format options
  format: [
    'progress-bar',
    'json:test-results/cucumber-report.json',
    'html:test-results/cucumber-report.html',
    '@cucumber/pretty-formatter'
  ],

  // Parallel execution settings
  parallel: 2,

  // Retry configuration for flaky tests
  retry: 1,

  // Test timeout (10 seconds)
  timeout: 10000,

  // Tags for filtering tests
  tags: process.env.CUCUMBER_TAGS || 'not @skip',

  // World parameters
  worldParameters: {
    // Test environment configuration
    testEnv: process.env.TEST_ENV || 'development',
    
    // CAS engine configuration
    casConfig: {
      storageType: 'memory',
      cacheSize: 1000,
      enableMetrics: true,
      performanceTarget: {
        hashTimeP95: 5,
        cacheHitRate: 0.80
      }
    },

    // Template engine configuration  
    templateConfig: {
      deterministic: true,
      templateDirs: ['features/fixtures/templates'],
      outputDir: 'test-output'
    },

    // Performance testing configuration
    performanceConfig: {
      maxRenderTime: 1000, // ms
      maxHashTime: 10, // ms
      minCacheHitRate: 0.8 // 80%
    }
  },

  // Setup and teardown hooks
  beforeAll: async function() {
    console.log('🚀 Starting CAS Engine BDD Tests...');
    
    // Ensure test output directories exist
    const fs = await import('fs/promises');
    const testDirs = ['test-results', 'test-output', 'test-temp'];
    
    for (const dir of testDirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    }
  },

  afterAll: async function() {
    console.log('✅ CAS Engine BDD Tests completed');
  }
});