#!/usr/bin/env node

/**
 * Module Resolution Test
 * Validates that ESM/CommonJS conflicts are resolved
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Module Resolution...');

// Test 1: ESM imports work
try {
  const packagePath = join(__dirname, '../package.json');
  const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  console.log('✅ ESM file system imports work');
  console.log(`   Package type: ${pkg.type}`);
} catch (error) {
  console.error('❌ ESM imports failed:', error.message);
  process.exit(1);
}

// Test 2: Configuration files can be imported
try {
  const streamingConfig = await import('../config/performance/streaming.config.js');
  console.log('✅ ESM config imports work');
  console.log(`   Streaming enabled: ${streamingConfig.default.enableStreaming}`);
} catch (error) {
  console.error('❌ Config imports failed:', error.message);
  process.exit(1);
}

// Test 3: Dynamic imports work
try {
  const fastVersionResolver = await import('../src/lib/fast-version-resolver.js');
  console.log('✅ Dynamic ESM imports work');
  console.log(`   Version function available: ${typeof fastVersionResolver.getVersion === 'function'}`);
} catch (error) {
  console.error('❌ Dynamic imports failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 All module resolution tests passed!');
console.log('📋 Summary:');
console.log('   • ESM syntax working correctly');
console.log('   • Configuration files converted');
console.log('   • Dynamic imports functional');
console.log('   • File system operations working');

export default {
  success: true,
  tests: {
    esmImports: true,
    configImports: true,
    dynamicImports: true,
    fileSystem: true
  }
};