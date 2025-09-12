#!/usr/bin/env node

/**
 * Manual CLI Testing Script
 * Tests core CLI functionality without complex test runners
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';

const PROJECT_ROOT = path.resolve(process.cwd());
const CLI_PATH = path.join(PROJECT_ROOT, 'bin/unjucks.js');

class ManualCliTester {
  constructor() {
    this.testDir = null;
    this.testResults = [];
  }

  async setup() {
    this.testDir = path.join(tmpdir(), 'unjucks-manual-test-' + this.getDeterministicTimestamp());
    await fs.mkdir(this.testDir, { recursive: true });
    process.chdir(this.testDir);
    console.log(`Test directory: ${this.testDir}`);
  }

  async cleanup() {
    if (this.testDir) {
      try {
        await fs.rm(this.testDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to cleanup test directory:', error);
      }
    }
  }

  async pathExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async runCli(command, args = [], options = {}) {
    const fullArgs = [CLI_PATH, command, ...args];
    
    return new Promise((resolve, reject) => {
      const child = spawn('node', fullArgs, {
        cwd: options.cwd || this.testDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...options.env }
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: code === 0
        });
      });

      child.on('error', (error) => {
        reject(error);
      });

      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`CLI command timed out: ${command} ${args.join(' ')}`));
      }, 10000);
    });
  }

  async test(name, testFn) {
    console.log(`\n🧪 Testing: ${name}`);
    try {
      await testFn();
      console.log(`✅ PASS: ${name}`);
      this.testResults.push({ name, status: 'PASS' });
    } catch (error) {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Error: ${error.message}`);
      this.testResults.push({ name, status: 'FAIL', error: error.message });
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  async runTests() {
    await this.setup();

    try {
      // Test 1: List command with no generators
      await this.test('List command shows empty message when no generators exist', async () => {
        const result = await this.runCli('list');
        this.assert(result.code === 0, `Expected exit code 0, got ${result.code}`);
        this.assert(result.stdout.includes('No generators found'), `Expected "No generators found", got: ${result.stdout}`);
      });

      // Test 2: Help command general help
      await this.test('Help command shows general help without arguments', async () => {
        const result = await this.runCli('help');
        this.assert(result.code === 0, `Expected exit code 0, got ${result.code}`);
        this.assert(result.stdout.includes('Usage'), `Expected "Usage" in help output, got: ${result.stdout}`);
      });

      // Test 3: Help command for nonexistent generator
      await this.test('Help command handles nonexistent generator', async () => {
        const result = await this.runCli('help', ['nonexistent']);
        this.assert(result.code !== 0, `Expected non-zero exit code, got ${result.code}`);
        this.assert(result.stderr.includes('Generator "nonexistent" not found'), `Expected generator not found error, got: ${result.stderr}`);
      });

      // Test 4: Generate command with missing generator
      await this.test('Generate command handles nonexistent generator', async () => {
        const result = await this.runCli('generate', ['nonexistent']);
        this.assert(result.code !== 0, `Expected non-zero exit code, got ${result.code}`);
        this.assert(result.stderr.includes('Generator "nonexistent" not found'), `Expected generator not found error, got: ${result.stderr}`);
      });

      // Test 5: Init command in empty directory
      await this.test('Init command initializes new project', async () => {
        const result = await this.runCli('init', ['--type', 'node', '--name', 'test-project']);
        this.assert(result.code === 0, `Expected exit code 0, got ${result.code}`);
        this.assert(await this.pathExists('_templates'), 'Expected _templates directory to exist');
        this.assert(await this.pathExists('README.md'), 'Expected README.md to exist');
      });

      // Test 6: Init command with existing templates directory
      await this.test('Init command handles existing templates directory', async () => {
        const result = await this.runCli('init', ['--type', 'node']);
        this.assert(result.code !== 0, `Expected non-zero exit code, got ${result.code}`);
        this.assert(result.stderr.includes('already exists'), `Expected "already exists" error, got: ${result.stderr}`);
      });

      // Test 7: List command with existing generators
      await this.test('List command shows available generators after init', async () => {
        const result = await this.runCli('list');
        this.assert(result.code === 0, `Expected exit code 0, got ${result.code}`);
        // After init, there should be some generators
        this.assert(!result.stdout.includes('No generators found'), `Should not show "No generators found" after init`);
      });

      // Test 8: Generate command with dry run
      await this.test('Generate command dry run mode', async () => {
        // First create a simple template for testing
        const templateDir = path.join(this.testDir, '_templates', 'test');
        await fs.mkdir(templateDir, { recursive: true });
        await fs.writeFile(
          path.join(templateDir, 'simple.njk'),
          '---\nto: "{{ dest }}/{{ name }}.js"\n---\nexport const {{ name }} = {};'
        );

        const result = await this.runCli('generate', ['test', 'simple', '--name', 'TestComponent', '--dest', 'src', '--dry']);
        this.assert(result.code === 0, `Expected exit code 0, got ${result.code}`);
        this.assert(result.stdout.includes('Would create'), `Expected "Would create" in dry run output, got: ${result.stdout}`);
        this.assert(!await this.pathExists('src/TestComponent.js'), 'File should not exist in dry run mode');
      });

    } finally {
      await this.cleanup();
    }

    // Report results
    console.log('\n📊 Test Results:');
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Total: ${this.testResults.length}`);

    if (failed > 0) {
      console.log('\n❌ Failed tests:');
      this.testResults.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`   • ${r.name}: ${r.error}`);
      });
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    }
  }
}

// Run tests
const tester = new ManualCliTester();
tester.runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});