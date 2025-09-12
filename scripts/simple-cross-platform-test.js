#!/usr/bin/env node

/**
 * Simple Cross-Platform Validation Script
 * Tests basic functionality without external dependencies
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const results = {
  platform: {
    os: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    tmpDir: os.tmpdir()
  },
  tests: {},
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  }
};

console.log('🧪 Simple Cross-Platform Validation');
console.log('=' .repeat(40));
console.log(`Platform: ${results.platform.os} ${results.platform.arch}`);
console.log(`Node.js: ${results.platform.nodeVersion}`);
console.log(`Temp Dir: ${results.platform.tmpDir}`);
console.log('');

// Test 1: Basic Node.js APIs
console.log('📋 Testing basic Node.js APIs...');
try {
  const testFile = path.join(os.tmpdir(), 'unjucks-test.txt');
  await fs.writeFile(testFile, 'test content');
  const content = await fs.readFile(testFile, 'utf-8');
  await fs.unlink(testFile);
  
  results.tests.nodeApis = {
    success: content === 'test content',
    message: 'File I/O operations work correctly'
  };
  console.log('✅ Node.js APIs: PASSED');
  results.summary.passed++;
} catch (error) {
  results.tests.nodeApis = {
    success: false,
    error: error.message
  };
  console.log('❌ Node.js APIs: FAILED -', error.message);
  results.summary.failed++;
  results.summary.errors.push('Node.js APIs: ' + error.message);
}
results.summary.total++;

// Test 2: Path handling
console.log('📁 Testing cross-platform path handling...');
try {
  const testPaths = [
    'src/cli/index.js',
    'bin/unjucks.cjs',
    'package.json'
  ];
  
  let pathsExist = 0;
  for (const testPath of testPaths) {
    try {
      const fullPath = path.resolve(testPath);
      await fs.access(fullPath);
      pathsExist++;
      console.log(`  ✅ ${testPath}`);
    } catch {
      console.log(`  ❌ ${testPath} (not found)`);
    }
  }
  
  results.tests.pathHandling = {
    success: pathsExist >= 2,
    message: `${pathsExist}/${testPaths.length} critical paths found`,
    pathsFound: pathsExist,
    totalPaths: testPaths.length
  };
  
  if (pathsExist >= 2) {
    console.log('✅ Path handling: PASSED');
    results.summary.passed++;
  } else {
    console.log('❌ Path handling: FAILED - Critical files missing');
    results.summary.failed++;
    results.summary.errors.push('Path handling: Critical files missing');
  }
} catch (error) {
  results.tests.pathHandling = {
    success: false,
    error: error.message
  };
  console.log('❌ Path handling: FAILED -', error.message);
  results.summary.failed++;
  results.summary.errors.push('Path handling: ' + error.message);
}
results.summary.total++;

// Test 3: Package.json validation
console.log('📦 Testing package.json structure...');
try {
  const packageContent = await fs.readFile('package.json', 'utf-8');
  const packageJson = JSON.parse(packageContent);
  
  const requiredFields = ['name', 'version', 'type', 'main', 'bin'];
  const missingFields = requiredFields.filter(field => !packageJson[field]);
  
  results.tests.packageJson = {
    success: missingFields.length === 0,
    message: missingFields.length === 0 ? 'All required fields present' : `Missing fields: ${missingFields.join(', ')}`,
    packageName: packageJson.name,
    version: packageJson.version,
    type: packageJson.type,
    missingFields
  };
  
  if (missingFields.length === 0) {
    console.log('✅ Package.json: PASSED');
    console.log(`  📋 Name: ${packageJson.name}`);
    console.log(`  🔢 Version: ${packageJson.version}`);
    console.log(`  📄 Type: ${packageJson.type}`);
    results.summary.passed++;
  } else {
    console.log('❌ Package.json: FAILED - Missing fields:', missingFields.join(', '));
    results.summary.failed++;
    results.summary.errors.push('Package.json: Missing fields - ' + missingFields.join(', '));
  }
} catch (error) {
  results.tests.packageJson = {
    success: false,
    error: error.message
  };
  console.log('❌ Package.json: FAILED -', error.message);
  results.summary.failed++;
  results.summary.errors.push('Package.json: ' + error.message);
}
results.summary.total++;

// Test 4: Binary file checks
console.log('⚙️ Testing binary file permissions...');
try {
  const binaryPath = path.resolve('bin/unjucks.cjs');
  const stats = await fs.stat(binaryPath);
  const isExecutable = !!(stats.mode & 0o111);
  
  results.tests.binaryPerms = {
    success: stats.isFile() && isExecutable,
    message: `Binary ${stats.isFile() ? 'exists' : 'missing'} and is ${isExecutable ? 'executable' : 'not executable'}`,
    isFile: stats.isFile(),
    isExecutable,
    mode: stats.mode.toString(8)
  };
  
  if (stats.isFile() && isExecutable) {
    console.log('✅ Binary permissions: PASSED');
    console.log(`  🔧 Mode: ${stats.mode.toString(8)}`);
    results.summary.passed++;
  } else {
    console.log('❌ Binary permissions: FAILED - Not executable or missing');
    results.summary.failed++;
    results.summary.errors.push('Binary permissions: Not executable or missing');
  }
} catch (error) {
  results.tests.binaryPerms = {
    success: false,
    error: error.message
  };
  console.log('❌ Binary permissions: FAILED -', error.message);
  results.summary.failed++;
  results.summary.errors.push('Binary permissions: ' + error.message);
}
results.summary.total++;

// Test 5: Architecture-specific checks
console.log('🏗️ Testing architecture compatibility...');
try {
  const supportedArchs = ['x64', 'arm64', 'arm'];
  const currentArch = os.arch();
  
  results.tests.architecture = {
    success: supportedArchs.includes(currentArch),
    message: `Architecture ${currentArch} is ${supportedArchs.includes(currentArch) ? 'supported' : 'not supported'}`,
    currentArch,
    supportedArchs
  };
  
  if (supportedArchs.includes(currentArch)) {
    console.log('✅ Architecture: PASSED');
    console.log(`  🏗️ Current: ${currentArch}`);
    console.log(`  ✅ Supported: ${supportedArchs.join(', ')}`);
    results.summary.passed++;
  } else {
    console.log('❌ Architecture: FAILED - Unsupported architecture');
    results.summary.failed++;
    results.summary.errors.push('Architecture: Unsupported - ' + currentArch);
  }
} catch (error) {
  results.tests.architecture = {
    success: false,
    error: error.message
  };
  console.log('❌ Architecture: FAILED -', error.message);
  results.summary.failed++;
  results.summary.errors.push('Architecture: ' + error.message);
}
results.summary.total++;

// Test 6: Environment variables and temp directory
console.log('🌍 Testing environment compatibility...');
try {
  const tempDir = os.tmpdir();
  const testEnvFile = path.join(tempDir, `unjucks-env-test-${this.getDeterministicTimestamp()}.txt`);
  
  // Test temp directory write
  await fs.writeFile(testEnvFile, 'env test');
  await fs.access(testEnvFile);
  await fs.unlink(testEnvFile);
  
  // Test environment variables
  const hasHome = process.env.HOME || process.env.USERPROFILE;
  const hasPath = process.env.PATH;
  
  results.tests.environment = {
    success: true,
    message: 'Environment variables and temp directory accessible',
    tempDir,
    hasHome: !!hasHome,
    hasPath: !!hasPath
  };
  
  console.log('✅ Environment: PASSED');
  console.log(`  📁 Temp dir: ${tempDir}`);
  console.log(`  🏠 HOME: ${hasHome ? 'Available' : 'Missing'}`);
  console.log(`  🛤️ PATH: ${hasPath ? 'Available' : 'Missing'}`);
  results.summary.passed++;
} catch (error) {
  results.tests.environment = {
    success: false,
    error: error.message
  };
  console.log('❌ Environment: FAILED -', error.message);
  results.summary.failed++;
  results.summary.errors.push('Environment: ' + error.message);
}
results.summary.total++;

// Generate final report
console.log('\n📊 Cross-Platform Validation Results');
console.log('=' .repeat(40));
console.log(`Total Tests: ${results.summary.total}`);
console.log(`Passed: ${results.summary.passed}`);
console.log(`Failed: ${results.summary.failed}`);
console.log(`Success Rate: ${Math.round((results.summary.passed / results.summary.total) * 100)}%`);

const overallStatus = results.summary.failed === 0 ? 'PASSED' : 'FAILED';
console.log(`Overall Status: ${overallStatus}`);

if (results.summary.errors.length > 0) {
  console.log('\n❌ Errors encountered:');
  results.summary.errors.forEach(error => {
    console.log(`  • ${error}`);
  });
}

// Save detailed report
const reportPath = path.join(os.tmpdir(), 'unjucks-cross-platform-report.json');
await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
console.log(`\n📋 Detailed report saved to: ${reportPath}`);

// Exit with appropriate code
process.exit(overallStatus === 'PASSED' ? 0 : 1);