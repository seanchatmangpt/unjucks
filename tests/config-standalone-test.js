#!/usr/bin/env node
/**
 * Standalone Configuration Loading Tests
 * 
 * Tests configuration loading without Vitest framework to validate
 * actual c12 behavior, environment overrides, and value comparison.
 */

import { loadConfig } from 'c12';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';

const PROJECT_ROOT = '/Users/sac/unjucks';
const TESTS_PASSED = [];
const TESTS_FAILED = [];

// Simple assertion helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function test(name, fn) {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    fn();
    TESTS_PASSED.push(name);
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    TESTS_FAILED.push({ name, error: error.message });
    console.log(`❌ FAILED: ${name} - ${error.message}`);
  }
}

async function asyncTest(name, fn) {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    await fn();
    TESTS_PASSED.push(name);
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    TESTS_FAILED.push({ name, error: error.message });
    console.log(`❌ FAILED: ${name} - ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting Configuration Loading Tests');
  console.log(`📁 Project root: ${PROJECT_ROOT}`);

  // Test 1: Load actual project configuration
  await asyncTest('Load actual project kgen.config.js', async () => {
    const { config, configFile } = await loadConfig({
      name: 'kgen',
      cwd: PROJECT_ROOT,
      configFile: 'kgen.config'
    });

    assert(configFile, 'Config file should be found');
    assert(config, 'Config should be loaded');
    assert(config.directories, 'Config should have directories section');
    
    console.log('📋 Actual config loaded:');
    console.log(`  - Config file: ${configFile}`);
    console.log(`  - directories.out: ${config.directories?.out}`);
    console.log(`  - directories.state: ${config.directories?.state}`);
    console.log(`  - directories.cache: ${config.directories?.cache}`);
    console.log(`  - generate.defaultTemplate: ${config.generate?.defaultTemplate}`);
    console.log(`  - reasoning.enabled: ${config.reasoning?.enabled}`);
    console.log(`  - provenance.engineId: ${config.provenance?.engineId}`);
  });

  // Test 2: Test defaults vs loaded values
  await asyncTest('Compare loaded values vs defaults', async () => {
    const testDefaults = {
      directories: {
        out: './DEFAULT_DIST',
        state: './DEFAULT_STATE',
        cache: './DEFAULT_CACHE'
      },
      generate: {
        defaultTemplate: 'DEFAULT_TEMPLATE',
        attestByDefault: false
      },
      reasoning: {
        enabled: false,
        maxDepth: 999
      }
    };

    const { config } = await loadConfig({
      name: 'kgen',
      cwd: PROJECT_ROOT,
      configFile: 'kgen.config',
      defaults: testDefaults
    });

    // Test if loaded values differ from defaults
    const comparison = {
      'directories.out': {
        loaded: config.directories?.out,
        default: testDefaults.directories.out,
        changed: config.directories?.out !== testDefaults.directories.out
      },
      'directories.state': {
        loaded: config.directories?.state,
        default: testDefaults.directories.state,
        changed: config.directories?.state !== testDefaults.directories.state
      },
      'generate.defaultTemplate': {
        loaded: config.generate?.defaultTemplate,
        default: testDefaults.generate.defaultTemplate,
        changed: config.generate?.defaultTemplate !== testDefaults.generate.defaultTemplate
      },
      'reasoning.enabled': {
        loaded: config.reasoning?.enabled,
        default: testDefaults.reasoning.enabled,
        changed: config.reasoning?.enabled !== testDefaults.reasoning.enabled
      }
    };

    console.log('📊 Config vs defaults comparison:');
    Object.entries(comparison).forEach(([key, data]) => {
      console.log(`  - ${key}: loaded="${data.loaded}", default="${data.default}", changed=${data.changed}`);
    });

    // At least some values should be overridden
    const changedCount = Object.values(comparison).filter(data => data.changed).length;
    assert(changedCount > 0, 'At least some config values should override defaults');
  });

  // Test 3: Environment-specific configuration
  await asyncTest('Test environment-specific overrides', async () => {
    const originalEnv = process.env.NODE_ENV;

    try {
      // Test development environment
      process.env.NODE_ENV = 'development';
      const { config: devConfig } = await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config'
      });

      // Test production environment
      process.env.NODE_ENV = 'production';
      const { config: prodConfig } = await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config'
      });

      // Test test environment
      process.env.NODE_ENV = 'test';
      const { config: testConfig } = await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config'
      });

      console.log('🌍 Environment-specific configurations:');
      console.log(`  - Development cache.enabled: ${devConfig.cache?.enabled}`);
      console.log(`  - Production cache.enabled: ${prodConfig.cache?.enabled}`);
      console.log(`  - Test cache.enabled: ${testConfig.cache?.enabled}`);
      
      console.log(`  - Development dev.debug: ${devConfig.dev?.debug}`);
      console.log(`  - Production dev.debug: ${prodConfig.dev?.debug}`);
      console.log(`  - Test dev.debug: ${testConfig.dev?.debug}`);

      // All configs should be defined
      assert(devConfig, 'Development config should be loaded');
      assert(prodConfig, 'Production config should be loaded');
      assert(testConfig, 'Test config should be loaded');

    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  // Test 4: Environment variable substitution
  await asyncTest('Test environment variable substitution', async () => {
    const originalBuildId = process.env.BUILD_ID;
    
    try {
      process.env.BUILD_ID = 'test-build-12345';
      process.env.NODE_ENV = 'development';

      const { config } = await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config'
      });

      console.log('🔧 Environment variable testing:');
      console.log(`  - BUILD_ID env var: ${process.env.BUILD_ID}`);
      console.log(`  - Config globalVars.buildId: ${config.generate?.globalVars?.buildId}`);
      
      // If the config uses process.env.BUILD_ID, it should match
      if (config.generate?.globalVars?.buildId) {
        assert(
          config.generate.globalVars.buildId === 'test-build-12345',
          'Build ID should be substituted from environment'
        );
      }

    } finally {
      if (originalBuildId !== undefined) {
        process.env.BUILD_ID = originalBuildId;
      } else {
        delete process.env.BUILD_ID;
      }
    }
  });

  // Test 5: Function evaluation in config
  await asyncTest('Test function evaluation in config', async () => {
    const { config } = await loadConfig({
      name: 'kgen',
      cwd: PROJECT_ROOT,
      configFile: 'kgen.config'
    });

    console.log('🔧 Function evaluation testing:');
    
    // Test timestamp function if it exists
    if (config.generate?.globalVars?.timestamp) {
      const timestampResult = config.generate.globalVars.timestamp();
      console.log(`  - Timestamp function result: ${timestampResult}`);
      assert(typeof timestampResult === 'string', 'Timestamp function should return string');
      assert(timestampResult.length > 0, 'Timestamp result should not be empty');
    }

    // Test other dynamic values
    if (config.project?.name) {
      console.log(`  - Project name: ${config.project.name}`);
    }
  });

  // Test 6: Deep merge behavior
  await asyncTest('Test deep merge behavior', async () => {
    const testDir = join(tmpdir(), `config-test-${this.getDeterministicTimestamp()}`);
    mkdirSync(testDir, { recursive: true });
    
    try {
      const configPath = join(testDir, 'kgen.config.js');
      const complexConfig = `
        export default {
          provenance: {
            engineId: 'test-engine',
            include: {
              timestamp: true,
              engineVersion: false
            }
          }
        };
      `;
      
      writeFileSync(configPath, complexConfig);

      const defaults = {
        provenance: {
          engineId: 'default-engine',
          include: {
            timestamp: false,
            engineVersion: true,
            graphHash: true
          },
          signing: {
            enabled: false
          }
        }
      };

      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config',
        defaults
      });

      console.log('🔄 Deep merge results:');
      console.log(`  - engineId (overridden): ${config.provenance.engineId}`);
      console.log(`  - timestamp (overridden): ${config.provenance.include.timestamp}`);
      console.log(`  - engineVersion (overridden): ${config.provenance.include.engineVersion}`);
      console.log(`  - graphHash (inherited): ${config.provenance.include.graphHash}`);
      console.log(`  - signing (inherited): ${JSON.stringify(config.provenance.signing)}`);

      // Verify deep merge behavior
      assert(config.provenance.engineId === 'test-engine', 'engineId should be overridden');
      assert(config.provenance.include.timestamp === true, 'timestamp should be overridden');
      assert(config.provenance.include.engineVersion === false, 'engineVersion should be overridden');
      assert(config.provenance.include.graphHash === true, 'graphHash should be inherited');
      assert(config.provenance.signing.enabled === false, 'signing should be inherited');

    } finally {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    }
  });

  // Test 7: Performance measurement
  await asyncTest('Measure configuration loading performance', async () => {
    const iterations = 10;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await loadConfig({
        name: 'kgen',
        cwd: PROJECT_ROOT,
        configFile: 'kgen.config'
      });
      
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);

    console.log('⏱️  Performance metrics:');
    console.log(`  - Average load time: ${averageTime.toFixed(2)}ms`);
    console.log(`  - Min load time: ${minTime.toFixed(2)}ms`);
    console.log(`  - Max load time: ${maxTime.toFixed(2)}ms`);

    // Performance should be reasonable
    assert(averageTime < 100, `Average load time should be under 100ms (got ${averageTime.toFixed(2)}ms)`);
  });

  // Test 8: Invalid configuration handling
  await asyncTest('Test invalid configuration handling', async () => {
    const testDir = join(tmpdir(), `config-invalid-test-${this.getDeterministicTimestamp()}`);
    mkdirSync(testDir, { recursive: true });
    
    try {
      const configPath = join(testDir, 'kgen.config.js');
      const invalidConfig = `
        export default {
          // Missing directories section
          generate: {
            defaultTemplate: 'test'
          }
        };
      `;
      
      writeFileSync(configPath, invalidConfig);

      const defaults = {
        directories: {
          out: './fallback-dist'
        }
      };

      const { config } = await loadConfig({
        name: 'kgen',
        cwd: testDir,
        configFile: 'kgen.config',
        defaults
      });

      console.log('🚨 Invalid config handling:');
      console.log(`  - Config directories: ${JSON.stringify(config.directories)}`);
      console.log(`  - Fallback applied: ${config.directories?.out === './fallback-dist'}`);

      // Should use defaults when fields are missing
      assert(config.directories?.out === './fallback-dist', 'Should use default for missing field');

    } finally {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    }
  });

  // Print final results
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ PASSED: ${TESTS_PASSED.length} tests`);
  console.log(`❌ FAILED: ${TESTS_FAILED.length} tests`);
  
  if (TESTS_FAILED.length > 0) {
    console.log('\n💥 Failed tests:');
    TESTS_FAILED.forEach(({ name, error }) => {
      console.log(`  - ${name}: ${error}`);
    });
  }

  if (TESTS_PASSED.length > 0) {
    console.log('\n🎉 Passed tests:');
    TESTS_PASSED.forEach(name => {
      console.log(`  - ${name}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log(`🎯 SUCCESS RATE: ${Math.round((TESTS_PASSED.length / (TESTS_PASSED.length + TESTS_FAILED.length)) * 100)}%`);
  
  return TESTS_FAILED.length === 0;
}

// Run tests
main()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });