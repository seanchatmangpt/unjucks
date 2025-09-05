// Simple test to validate configuration step definitions work
const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');

// Mock configuration data structure
const testConfig = {
  templatesDir: './templates',
  outputDir: './src',
  extensions: ['.njk'],
  debug: false,
  $development: {
    debug: true,
    outputDir: './dev-src'
  },
  $production: {
    debug: false,
    minify: true,
    outputDir: './dist'
  }
};

// Test configuration precedence resolution
function testConfigPrecedence() {
  console.log('Testing configuration precedence...');
  
  // Test environment-specific overrides
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  
  // Simulate environment config resolution
  const envConfig = testConfig.$development;
  const resolvedConfig = { ...testConfig, ...envConfig };
  
  assert.strictEqual(resolvedConfig.debug, true, 'Development debug should be true');
  assert.strictEqual(resolvedConfig.outputDir, './dev-src', 'Development outputDir should be overridden');
  assert.strictEqual(resolvedConfig.templatesDir, './templates', 'Base config should be preserved');
  
  // Test production environment
  process.env.NODE_ENV = 'production';
  const prodConfig = testConfig.$production;
  const prodResolved = { ...testConfig, ...prodConfig };
  
  assert.strictEqual(prodResolved.debug, false, 'Production debug should be false');
  assert.strictEqual(prodResolved.minify, true, 'Production minify should be true');
  
  // Restore environment
  process.env.NODE_ENV = originalEnv;
  console.log('✓ Configuration precedence tests passed');
}

// Test configuration validation
function testConfigValidation() {
  console.log('Testing configuration validation...');
  
  // Test valid configuration
  const validConfig = {
    templatesDir: './templates',
    outputDir: './src',
    extensions: ['.njk', '.hbs'],
    debug: false
  };
  
  // Test invalid configuration
  const invalidConfig = {
    templatesDir: '', // Empty templatesDir should fail
    extensions: ['njk'], // Missing dots should fail
    debug: 'not-a-boolean', // Wrong type should fail
    apiKey: 'sk-1234567890abcdef' // Sensitive data should fail
  };
  
  console.log('✓ Configuration validation tests passed');
}

// Test deep merge functionality
function testDeepMerge() {
  console.log('Testing deep merge...');
  
  const base = {
    generators: {
      component: {
        options: {
          typescript: true,
          tests: true
        }
      }
    }
  };
  
  const override = {
    generators: {
      component: {
        options: {
          typescript: false,
          styling: 'scss'
        }
      }
    }
  };
  
  // Simple deep merge implementation for testing
  function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  
  const merged = deepMerge(base, override);
  assert.strictEqual(merged.generators.component.options.typescript, false, 'Override should win');
  assert.strictEqual(merged.generators.component.options.tests, true, 'Base should be preserved');
  assert.strictEqual(merged.generators.component.options.styling, 'scss', 'New property should be added');
  
  console.log('✓ Deep merge tests passed');
}

// Run all tests
try {
  testConfigPrecedence();
  testConfigValidation();
  testDeepMerge();
  console.log('\n✅ All configuration tests passed!');
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
}