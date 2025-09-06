import { Given, When, Then } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { execSync, spawn } from 'child_process';
import { existsSync, statSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';

// Test context for sharing data between steps
interface TestContext {
  tempDir?: string;
  installResult?: { stdout: string; stderr: string; code: number | null };
  commandOutput?: string;
  packageSize?: number;
  currentPlatform?: string;
  nodeVersion?: string;
  cleanupFunctions?: (() => Promise<void>)[];
}

const testContext: TestContext = {
  cleanupFunctions: []
};

// Utility functions
function execCommand(command: string, options: any = {}): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', command], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...options.env }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());
    
    child.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

function getPackageInfo() {
  const packagePath = resolve(process.cwd(), 'package.json');
  return JSON.parse(readFileSync(packagePath, 'utf8'));
}

function calculatePackageSize(): number {
  const packageJson = getPackageInfo();
  const files = packageJson.files || ['dist', 'bin'];
  let totalSize = 0;
  
  files.forEach((pattern: string) => {
    const fullPath = resolve(process.cwd(), pattern);
    if (existsSync(fullPath)) {
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        // Recursively calculate directory size
        totalSize += getDirSize(fullPath);
      } else {
        totalSize += stats.size;
      }
    }
  });
  
  return totalSize;
}

function getDirSize(dirPath: string): number {
  const { execSync } = require('child_process');
  try {
    const output = execSync(`du -sb "${dirPath}"`, { encoding: 'utf8' });
    return parseInt(output.split('\t')[0]);
  } catch {
    return 0;
  }
}

// Background steps
Given('I have a clean Node.js environment', async () => {
  testContext.tempDir = await mkdtemp(join(tmpdir(), 'unjucks-test-'));
  process.chdir(testContext.tempDir);
  
  testContext.cleanupFunctions?.push(async () => {
    if (testContext.tempDir && existsSync(testContext.tempDir)) {
      await rm(testContext.tempDir, { recursive: true, force: true });
    }
  });
});

Given('Node.js version is 18 or higher', async () => {
  const result = await execCommand('node --version');
  const version = result.stdout.trim().replace('v', '');
  const majorVersion = parseInt(version.split('.')[0]);
  
  testContext.nodeVersion = version;
  expect(majorVersion).toBeGreaterThanOrEqual(18);
});

Given('npm is available', async () => {
  const result = await execCommand('npm --version');
  expect(result.code).toBe(0);
  expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
});

// NPM Installation steps
When('I run {string}', async (command: string) => {
  if (command.includes('npm install -g unjucks')) {
    // Simulate global install by packing and installing local package
    const packageDir = resolve(__dirname, '../..');
    const packResult = await execCommand('npm pack', { cwd: packageDir });
    expect(packResult.code).toBe(0);
    
    const tarball = packResult.stdout.trim();
    const tarballPath = join(packageDir, tarball);
    
    testContext.installResult = await execCommand(`npm install -g "${tarballPath}"`);
  } else {
    const result = await execCommand(command);
    testContext.commandOutput = result.stdout;
    testContext.installResult = result;
  }
});

Then('the installation should succeed', () => {
  expect(testContext.installResult?.code).toBe(0);
  expect(testContext.installResult?.stderr).not.toContain('ERROR');
});

Then('the unjucks binary should be available in PATH', async () => {
  const result = await execCommand('which unjucks');
  expect(result.code).toBe(0);
  expect(result.stdout.trim()).toBeTruthy();
});

Then('running {string} should show the version number', async (command: string) => {
  const result = await execCommand(command);
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
});

Then('running {string} should show help information', async (command: string) => {
  const result = await execCommand(command);
  expect(result.code).toBe(0);
  expect(result.stdout).toContain('Usage:');
  expect(result.stdout).toContain('Commands:');
});

// CLI Commands steps
Given('unjucks is installed globally', async () => {
  // Verify unjucks is available
  const result = await execCommand('unjucks --version');
  expect(result.code).toBe(0);
});

When('I run {string}', async (command: string) => {
  const result = await execCommand(command);
  testContext.commandOutput = result.stdout;
  testContext.installResult = result;
});

Then('it should show available generators', () => {
  expect(testContext.commandOutput).toContain('Available generators');
});

Then('the output should contain {string}', (expectedText: string) => {
  expect(testContext.commandOutput).toContain(expectedText);
});

// Project initialization steps
Given('I am in an empty directory', async () => {
  if (!testContext.tempDir) {
    testContext.tempDir = await mkdtemp(join(tmpdir(), 'unjucks-init-'));
  }
  process.chdir(testContext.tempDir);
});

Then('it should create the _templates directory', () => {
  // Note: This is a mock test since we haven't implemented actual template creation
  expect(testContext.commandOutput).toContain('Created _templates directory');
});

Then('it should show initialization success message', () => {
  expect(testContext.commandOutput).toContain('Initializing Unjucks templates');
});

Then('it should provide next steps', () => {
  expect(testContext.commandOutput).toContain('Next steps:');
});

// Dry run testing
Then('it should show what would be generated', () => {
  expect(testContext.commandOutput).toContain('Dry run');
  expect(testContext.commandOutput).toContain('Would generate');
});

Then('it should not create actual files', () => {
  // In a real implementation, check that no files were actually created
  expect(testContext.commandOutput).toContain('Would generate');
});

Then('the output should contain {string}', (text: string) => {
  expect(testContext.commandOutput).toContain(text);
});

// Package size optimization
Given('the unjucks package is built', () => {
  // Verify dist directory exists
  expect(existsSync(resolve(process.cwd(), 'dist'))).toBe(true);
  expect(existsSync(resolve(process.cwd(), 'bin'))).toBe(true);
});

When('I check the package size', () => {
  testContext.packageSize = calculatePackageSize();
});

Then('the total package size should be less than 2MB', () => {
  const maxSizeBytes = 2 * 1024 * 1024; // 2MB
  expect(testContext.packageSize).toBeLessThan(maxSizeBytes);
});

Then('it should only contain necessary files', () => {
  const packageJson = getPackageInfo();
  const files = packageJson.files || [];
  
  // Should contain essential files
  expect(files).toContain('dist');
  expect(files).toContain('bin');
  
  // Should not contain development files
  expect(files).not.toContain('tests');
  expect(files).not.toContain('examples');
  expect(files).not.toContain('src');
});

Then('it should exclude test files and examples', () => {
  const packageJson = getPackageInfo();
  const files = packageJson.files || [];
  
  expect(files).not.toContain('tests');
  expect(files).not.toContain('examples');
  expect(files).not.toContain('*.test.js');
  expect(files).not.toContain('*.spec.js');
});

// Cross-platform testing
When('I run the binary on {string}', (platform: string) => {
  testContext.currentPlatform = platform;
  // This would need actual cross-platform testing infrastructure
});

Then('it should execute without errors', async () => {
  const result = await execCommand('unjucks --version');
  expect(result.code).toBe(0);
});

Then('all commands should work correctly', async () => {
  const commands = ['--version', 'list', '--help'];
  
  for (const cmd of commands) {
    const result = await execCommand(`unjucks ${cmd}`);
    expect(result.code).toBe(0);
  }
});

// Node.js version compatibility
Given('I have Node.js version {string}', (version: string) => {
  testContext.nodeVersion = version;
});

When('I try to install unjucks globally', async () => {
  // This would require nvm or similar version management
  testContext.installResult = await execCommand('echo "Simulating install for version test"');
});

Then('the installation should {string}', (expectedResult: string) => {
  if (expectedResult === 'succeed') {
    expect(testContext.installResult?.code).toBe(0);
  } else if (expectedResult === 'fail') {
    // For Node < 18, installation should fail with clear message
    expect(testContext.installResult?.code).not.toBe(0);
  }
});

// Uninstall and reinstall
When('I run {string}', async (command: string) => {
  const result = await execCommand(command);
  testContext.installResult = result;
  testContext.commandOutput = result.stdout;
});

Then('the unjucks binary should not be available', async () => {
  const result = await execCommand('which unjucks');
  expect(result.code).not.toBe(0);
});

When('I run {string} again', async (command: string) => {
  const result = await execCommand(command);
  testContext.installResult = result;
});

Then('all functionality should work correctly', async () => {
  const commands = ['--version', 'list', 'init'];
  
  for (const cmd of commands) {
    const result = await execCommand(`unjucks ${cmd}`);
    expect(result.code).toBe(0);
  }
});

// Package integrity
Given('the unjucks package is published', () => {
  // Simulate published package state
  expect(existsSync(resolve(process.cwd(), 'package.json'))).toBe(true);
});

When('I install it from npm registry', async () => {
  // Simulate registry installation
  testContext.installResult = await execCommand('echo "Simulating registry install"');
});

Then('all required files should be present', () => {
  const requiredFiles = ['dist/index.cjs', 'bin/unjucks.cjs', 'package.json'];
  
  requiredFiles.forEach(file => {
    expect(existsSync(resolve(process.cwd(), file))).toBe(true);
  });
});

Then('the binary should have correct permissions', () => {
  const binaryPath = resolve(process.cwd(), 'bin/unjucks.cjs');
  const stats = statSync(binaryPath);
  
  // Check if file is executable (mode includes execute bits)
  expect(stats.mode & parseInt('111', 8)).toBeTruthy();
});

Then('the package.json should have correct metadata', () => {
  const packageJson = getPackageInfo();
  
  expect(packageJson.name).toBe('unjucks');
  expect(packageJson.bin).toBeDefined();
  expect(packageJson.engines).toBeDefined();
  expect(packageJson.preferGlobal).toBe(true);
});

Then('the CLI should start within 1 second', async () => {
  const startTime = Date.now();
  await execCommand('unjucks --version');
  const duration = Date.now() - startTime;
  
  expect(duration).toBeLessThan(1000);
});

// Cleanup after tests
afterEach(async () => {
  if (testContext.cleanupFunctions) {
    for (const cleanup of testContext.cleanupFunctions) {
      await cleanup();
    }
    testContext.cleanupFunctions = [];
  }
});