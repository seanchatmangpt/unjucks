#!/usr/bin/env node

/**
 * CLI Integration Validation Script
 * Tests the core command functions directly to validate fixes
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

// Import commands directly
import { listCommand } from '../src/commands/list.js';
import { helpCommand } from '../src/commands/help.js';
import { generateCommand } from '../src/commands/generate.js';
import { initCommand } from '../src/commands/init.js';

class ValidationTester {
  constructor() {
    this.testDir = null;
    this.testResults = [];
    this.originalCwd = process.cwd();
  }

  async setup() {
    this.testDir = path.join(tmpdir(), 'unjucks-validation-' + Date.now());
    await fs.mkdir(this.testDir, { recursive: true });
    process.chdir(this.testDir);
    console.log(`Test directory: ${this.testDir}`);
  }

  async cleanup() {
    process.chdir(this.originalCwd);
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
      await this.test('List command returns success with empty message when no generators exist', async () => {
        const result = await listCommand.run({
          args: { generator: undefined, format: 'table', sort: 'name', direction: 'asc', detailed: false, stats: false, quiet: false, verbose: false }
        });
        
        this.assert(result.success === true, `Expected success: true, got ${result.success}`);
        this.assert(result.message === 'No generators found', `Expected "No generators found", got: ${result.message}`);
        this.assert(Array.isArray(result.data) && result.data.length === 0, `Expected empty data array, got: ${result.data}`);
      });

      // Test 2: Help command for nonexistent generator
      await this.test('Help command returns error for nonexistent generator', async () => {
        const result = await helpCommand.run({
          args: { generator: 'nonexistent', template: undefined, verbose: false }
        });
        
        this.assert(result.success === false, `Expected success: false, got ${result.success}`);
        this.assert(result.message.includes('not found'), `Expected "not found" in message, got: ${result.message}`);
      });

      // Test 3: Generate command with missing generator
      await this.test('Generate command returns error for nonexistent generator', async () => {
        const result = await generateCommand.run({
          args: { 
            generator: 'nonexistent', 
            template: 'test',
            name: 'TestComponent',
            dest: 'src',
            force: false,
            dry: false,
            backup: false,
            skipPrompts: true,
            verbose: false,
            quiet: false
          }
        });
        
        this.assert(result.success === false, `Expected success: false, got ${result.success}`);
        this.assert(result.message.includes('not found'), `Expected "not found" in message, got: ${result.message}`);
      });

      // Test 4: Init command in empty directory
      await this.test('Init command creates templates directory', async () => {
        const result = await initCommand.run({
          args: {
            type: 'node',
            name: 'test-project',
            dest: '.',
            force: false,
            skipGit: true,
            skipInstall: true,
            quiet: false,
            verbose: false
          }
        });
        
        this.assert(result.success === true, `Expected success: true, got ${result.success}`);
        this.assert(result.files && result.files.length > 0, `Expected files to be created, got: ${result.files}`);
        this.assert(await this.pathExists('_templates'), 'Expected _templates directory to exist');
      });

      // Test 5: Init command with existing templates directory
      await this.test('Init command handles existing templates directory', async () => {
        const result = await initCommand.run({
          args: {
            type: 'node',
            name: 'test-project-2',
            dest: '.',
            force: false,
            skipGit: true,
            skipInstall: true,
            quiet: false,
            verbose: false
          }
        });
        
        this.assert(result.success === false, `Expected success: false, got ${result.success}`);
        this.assert(result.message.includes('already exists'), `Expected "already exists" in message, got: ${result.message}`);
      });

      // Test 6: List command with existing generators (after init)
      await this.test('List command shows generators after init', async () => {
        const result = await listCommand.run({
          args: { generator: undefined, format: 'table', sort: 'name', direction: 'asc', detailed: false, stats: false, quiet: false, verbose: false }
        });
        
        this.assert(result.success === true, `Expected success: true, got ${result.success}`);
        this.assert(result.data && result.data.length > 0, `Expected generators to be found, got: ${result.data}`);
      });

      // Test 7: Generate command with dry run
      await this.test('Generate command dry run functionality', async () => {
        // First create a simple template for testing
        const templateDir = path.join(this.testDir, '_templates', 'test');
        await fs.mkdir(templateDir, { recursive: true });
        await fs.writeFile(
          path.join(templateDir, 'simple.njk'),
          '---\nto: "{{ dest }}/{{ name }}.js"\n---\nexport const {{ name }} = {};'
        );

        const result = await generateCommand.run({
          args: {
            generator: 'test',
            template: 'simple',
            name: 'TestComponent',
            dest: 'src',
            force: false,
            dry: true,
            backup: false,
            skipPrompts: true,
            verbose: false,
            quiet: false
          }
        });
        
        this.assert(result.success === true, `Expected success: true, got ${result.success}`);
        this.assert(result.message.includes('Dry run'), `Expected "Dry run" in message, got: ${result.message}`);
        this.assert(!await this.pathExists('src/TestComponent.js'), 'File should not exist in dry run mode');
      });

      // Test 8: Help command with valid generator
      await this.test('Help command works with valid generator after templates exist', async () => {
        const result = await helpCommand.run({
          args: { generator: 'test', template: undefined, verbose: false }
        });
        
        this.assert(result.success === true, `Expected success: true, got ${result.success}`);
        this.assert(result.message && result.message.includes('help'), `Expected help-related message, got: ${result.message}`);
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
      console.log('\n🎉 All CLI integration fixes validated successfully!');
      console.log('\n📋 Summary of fixes implemented:');
      console.log('   • List command now returns success with proper message for empty directories');
      console.log('   • Help command returns error objects instead of calling process.exit()');
      console.log('   • Generate command validates generators and templates with proper error handling');
      console.log('   • Init command handles existing directories gracefully');
      console.log('   • All commands now use consistent error handling patterns');
      console.log('   • Dry run mode works correctly for generate command');
      
      process.exit(0);
    }
  }
}

// Run validation tests
const tester = new ValidationTester();
tester.runTests().catch(error => {
  console.error('Validation script failed:', error);
  process.exit(1);
});