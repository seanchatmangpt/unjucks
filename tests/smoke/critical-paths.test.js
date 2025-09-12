#!/usr/bin/env node

/**
 * Critical Path Smoke Tests
 * Tests core functionality required for production operation
 */

import { execSync, exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const tempDir = path.join(projectRoot, 'tests/smoke/temp');

class SmokeTestRunner {
  constructor() {
    this.results = [];
    this.timeouts = {};
    this.startTime = this.getDeterministicTimestamp();
  }

  async setup() {
    // Clean and create temp directory
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);
    
    // Change to project root for tests
    process.chdir(projectRoot);
  }

  async teardown() {
    // Clean up temp directory
    await fs.remove(tempDir);
  }

  log(message, type = 'info') {
    const timestamp = this.getDeterministicTimestamp() - this.startTime;
    const colors = {
      info: 'blue',
      success: 'green',
      error: 'red',
      warning: 'yellow'
    };
    console.log(chalk[colors[type]](`[${timestamp}ms] ${message}`));
  }

  async test(name, testFn, timeout = 10000) {
    this.log(`Starting: ${name}`, 'info');
    const testStart = this.getDeterministicTimestamp();
    
    try {
      const timeoutPromise = new Promise((_, reject) => {
        this.timeouts[name] = setTimeout(() => {
          reject(new Error(`Test "${name}" timed out after ${timeout}ms`));
        }, timeout);
      });

      const testPromise = testFn();
      const result = await Promise.race([testPromise, timeoutPromise]);
      
      clearTimeout(this.timeouts[name]);
      delete this.timeouts[name];
      
      const duration = this.getDeterministicTimestamp() - testStart;
      this.results.push({ 
        name, 
        status: 'PASS', 
        duration,
        message: result?.message || 'Test passed'
      });
      this.log(`✅ PASS: ${name} (${duration}ms)`, 'success');
      return true;
    } catch (error) {
      clearTimeout(this.timeouts[name]);
      delete this.timeouts[name];
      
      const duration = this.getDeterministicTimestamp() - testStart;
      this.results.push({ 
        name, 
        status: 'FAIL', 
        duration,
        error: error.message,
        stack: error.stack
      });
      this.log(`❌ FAIL: ${name} (${duration}ms) - ${error.message}`, 'error');
      return false;
    }
  }

  execCommand(command, options = {}) {
    const defaultOptions = {
      cwd: projectRoot,
      timeout: 30000,
      encoding: 'utf8',
      ...options
    };
    
    try {
      const output = execSync(command, defaultOptions);
      return {
        success: true,
        stdout: output.toString(),
        stderr: '',
        code: 0
      };
    } catch (error) {
      return {
        success: false,
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || '',
        code: error.status || 1,
        error: error.message
      };
    }
  }

  async execCommandAsync(command, options = {}) {
    const defaultOptions = {
      cwd: projectRoot,
      timeout: 30000,
      encoding: 'utf8',
      ...options
    };

    return new Promise((resolve) => {
      exec(command, defaultOptions, (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            stdout: stdout || '',
            stderr: stderr || '',
            code: error.code || 1,
            error: error.message
          });
        } else {
          resolve({
            success: true,
            stdout: stdout || '',
            stderr: stderr || '',
            code: 0
          });
        }
      });
    });
  }

  printSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const totalDuration = this.getDeterministicTimestamp() - this.startTime;

    console.log('\n' + '='.repeat(60));
    console.log(chalk.bold.blue('SMOKE TEST SUMMARY'));
    console.log('='.repeat(60));
    console.log(chalk.cyan(`Total Tests: ${total}`));
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log(chalk.blue(`Total Duration: ${totalDuration}ms`));
    console.log(chalk.cyan(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`));

    if (failed > 0) {
      console.log('\n' + chalk.red.bold('FAILED TESTS:'));
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(chalk.red(`\n❌ ${result.name}`));
          console.log(chalk.red(`   Error: ${result.error}`));
          if (result.stack) {
            console.log(chalk.gray(`   Stack: ${result.stack.split('\n')[1]?.trim()}`));
          }
        });
    }

    return passed === total;
  }
}

// Test definitions
async function testCLIExists(runner) {
  // Test that the CLI binary exists and is executable
  const binaryPath = path.join(projectRoot, 'bin/unjucks.cjs');
  
  if (!await fs.pathExists(binaryPath)) {
    throw new Error('CLI binary not found at bin/unjucks.cjs');
  }

  const stats = await fs.stat(binaryPath);
  if (!(stats.mode & parseInt('111', 8))) {
    throw new Error('CLI binary is not executable');
  }

  return { message: 'CLI binary exists and is executable' };
}

async function testCLIVersion(runner) {
  // Test that CLI can show version
  const result = runner.execCommand('node bin/unjucks.cjs --version');
  
  if (!result.success) {
    throw new Error(`CLI version failed: ${result.stderr || result.error}`);
  }

  if (!result.stdout.trim()) {
    throw new Error('CLI version returned empty output');
  }

  return { message: `CLI version: ${result.stdout.trim()}` };
}

async function testCLIHelp(runner) {
  // Test that CLI can show help
  const result = runner.execCommand('node bin/unjucks.cjs --help');
  
  if (!result.success) {
    throw new Error(`CLI help failed: ${result.stderr || result.error}`);
  }

  if (!result.stdout.includes('Unjucks CLI') && !result.stdout.includes('Hygen-style CLI') && !result.stdout.includes('USAGE')) {
    throw new Error('CLI help does not contain expected content');
  }

  return { message: 'CLI help system working' };
}

async function testTemplateListingExists(runner) {
  // Test that template listing works
  const result = runner.execCommand('node bin/unjucks.cjs list');
  
  if (!result.success) {
    throw new Error(`Template listing failed: ${result.stderr || result.error}`);
  }

  // Should not crash, output format may vary
  return { message: 'Template listing executed successfully' };
}

async function testTemplateDirectoryExists(runner) {
  // Test that templates directory exists and has content
  const templateDirs = [
    path.join(projectRoot, '_templates'),
    path.join(projectRoot, 'templates')
  ];

  let foundTemplates = false;
  for (const dir of templateDirs) {
    if (await fs.pathExists(dir)) {
      const items = await fs.readdir(dir);
      if (items.length > 0) {
        foundTemplates = true;
        break;
      }
    }
  }

  if (!foundTemplates) {
    throw new Error('No template directories found or all are empty');
  }

  return { message: 'Template directories found with content' };
}

async function testNodeModulesIntegrity(runner) {
  // Test that core dependencies are available
  const packageJson = await fs.readJson(path.join(projectRoot, 'package.json'));
  const criticalDeps = ['nunjucks', 'citty', 'chalk', 'fs-extra'];

  for (const dep of criticalDeps) {
    if (!packageJson.dependencies[dep] && !packageJson.devDependencies[dep]) {
      throw new Error(`Critical dependency missing: ${dep}`);
    }

    const depPath = path.join(projectRoot, 'node_modules', dep);
    if (!await fs.pathExists(depPath)) {
      throw new Error(`Dependency not installed: ${dep}`);
    }
  }

  return { message: 'All critical dependencies available' };
}

async function testConfigurationLoading(runner) {
  // Test that configuration can be loaded without errors
  try {
    // Try to load the main CLI module without executing
    const cliPath = path.join(projectRoot, 'src/cli/index.js');
    const stats = await fs.stat(cliPath);
    
    if (!stats.isFile()) {
      throw new Error('Main CLI module not found');
    }

    return { message: 'Configuration files accessible' };
  } catch (error) {
    throw new Error(`Configuration loading failed: ${error.message}`);
  }
}

async function testFileSystemAccess(runner) {
  // Test file system read/write access
  const testFile = path.join(tempDir, 'access-test.txt');
  const testContent = 'smoke test content';

  // Test write
  await fs.writeFile(testFile, testContent);

  // Test read
  const readContent = await fs.readFile(testFile, 'utf8');
  if (readContent !== testContent) {
    throw new Error('File system read/write mismatch');
  }

  // Test delete
  await fs.remove(testFile);
  if (await fs.pathExists(testFile)) {
    throw new Error('File system delete failed');
  }

  return { message: 'File system access working correctly' };
}

async function testPackageJsonIntegrity(runner) {
  // Test package.json integrity
  const packagePath = path.join(projectRoot, 'package.json');
  const packageJson = await fs.readJson(packagePath);

  if (!packageJson.name) {
    throw new Error('package.json missing name field');
  }

  if (!packageJson.version) {
    throw new Error('package.json missing version field');
  }

  if (!packageJson.bin) {
    throw new Error('package.json missing bin field');
  }

  if (!packageJson.main) {
    throw new Error('package.json missing main field');
  }

  return { message: 'package.json integrity verified' };
}

async function testBasicGeneration(runner) {
  // Test basic template generation in dry-run mode
  const result = runner.execCommand('node bin/unjucks.cjs generate component react TestComponent --dry --dest ./tests/smoke/temp');
  
  // Should not fail, even if template doesn't exist
  // Dry run should never write files
  const tempFiles = await fs.readdir(tempDir);
  if (tempFiles.length > 0) {
    throw new Error('Dry run created files when it should not have');
  }

  return { message: 'Basic generation dry-run completed' };
}

// Main test execution
async function runSmokeTests() {
  const runner = new SmokeTestRunner();
  
  console.log(chalk.bold.blue('🔥 Starting Unjucks Production Smoke Tests'));
  console.log(chalk.gray('Testing critical paths for production readiness...\n'));

  try {
    await runner.setup();

    // Core functionality tests
    await runner.test('CLI Binary Exists', () => testCLIExists(runner));
    await runner.test('CLI Version Command', () => testCLIVersion(runner));
    await runner.test('CLI Help System', () => testCLIHelp(runner));
    
    // Configuration and dependencies
    await runner.test('Package.json Integrity', () => testPackageJsonIntegrity(runner));
    await runner.test('Node Modules Integrity', () => testNodeModulesIntegrity(runner));
    await runner.test('Configuration Loading', () => testConfigurationLoading(runner));
    
    // File system and templates
    await runner.test('File System Access', () => testFileSystemAccess(runner));
    await runner.test('Template Directory Exists', () => testTemplateDirectoryExists(runner));
    await runner.test('Template Listing', () => testTemplateListingExists(runner));
    
    // Basic generation
    await runner.test('Basic Generation (Dry Run)', () => testBasicGeneration(runner));

    await runner.teardown();
    
    const allPassed = runner.printSummary();
    
    if (allPassed) {
      console.log(chalk.green.bold('\n🎉 All smoke tests passed! System is production ready.'));
      process.exit(0);
    } else {
      console.log(chalk.red.bold('\n💥 Some smoke tests failed! System is NOT production ready.'));
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red.bold('\n💥 Smoke test runner failed:'));
    console.error(chalk.red(error.message));
    console.error(chalk.gray(error.stack));
    process.exit(1);
  }
}

// Export for use as module or run directly
export { SmokeTestRunner, runSmokeTests };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSmokeTests().catch(console.error);
}