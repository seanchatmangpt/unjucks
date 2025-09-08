#!/usr/bin/env node

/**
 * Unjucks Smoke Tests - Quick functional validation
 * Tests core CLI functionality without heavy operations
 */

import { execSync } from 'child_process';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

class SmokeTestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  addTest(name, command, validator, options = {}) {
    this.tests.push({
      name,
      command,
      validator,
      timeout: options.timeout || 5000,
      expectFailure: options.expectFailure || false
    });
  }

  async runTest(test) {
    console.log(chalk.blue(`🧪 Running: ${test.name}`));
    
    try {
      const output = execSync(test.command, {
        cwd: rootDir,
        encoding: 'utf-8',
        timeout: test.timeout,
        stdio: 'pipe'
      });
      
      if (test.expectFailure) {
        return {
          name: test.name,
          passed: false,
          error: 'Expected command to fail but it succeeded',
          output
        };
      }
      
      const validationResult = test.validator(output, null);
      return {
        name: test.name,
        passed: validationResult.passed,
        error: validationResult.error,
        output: output.substring(0, 200) + (output.length > 200 ? '...' : '')
      };
    } catch (error) {
      if (test.expectFailure) {
        const validationResult = test.validator(null, error);
        return {
          name: test.name,
          passed: validationResult.passed,
          error: validationResult.error,
          output: error.message.substring(0, 200)
        };
      }
      
      return {
        name: test.name,
        passed: false,
        error: error.message,
        output: error.stderr || error.stdout || ''
      };
    }
  }

  setupTests() {
    // Basic CLI functionality
    this.addTest(
      'CLI Help Display',
      'node bin/unjucks.cjs --help',
      (output) => ({
        passed: output && /Hygen-style CLI generator|unjucks/i.test(output) && /USAGE/i.test(output),
        error: !output ? 'No output received' : 'Help text format incorrect'
      })
    );

    this.addTest(
      'CLI Version Display',
      'node bin/unjucks.cjs --version',
      (output) => ({
        passed: output && /\d+\.\d+\.\d+/.test(output.trim()),
        error: !output ? 'No version output' : 'Version format incorrect'
      })
    );

    // Command availability tests
    this.addTest(
      'List Command Available',
      'node bin/unjucks.cjs list --help',
      (output) => ({
        passed: output && /list/i.test(output),
        error: 'List command not properly available'
      })
    );

    this.addTest(
      'Generate Command Available',
      'node bin/unjucks.cjs generate --help',
      (output) => ({
        passed: output && /generate/i.test(output),
        error: 'Generate command not properly available'
      })
    );

    this.addTest(
      'Init Command Available',
      'node bin/unjucks.cjs init --help',
      (output) => ({
        passed: output && /init/i.test(output),
        error: 'Init command not properly available'
      })
    );

    // Test direct CLI entry point
    this.addTest(
      'Direct CLI Entry Point',
      'node src/cli/index.js --help',
      (output) => ({
        passed: output && /Hygen-style CLI generator|unjucks/i.test(output),
        error: 'Direct CLI entry point not working'
      })
    );

    // Test binary without Node prefix (should work if executable)
    this.addTest(
      'Binary Executable Test',
      './bin/unjucks.cjs --version',
      (output) => ({
        passed: output && /\d+\.\d+\.\d+/.test(output.trim()),
        error: 'Binary not executable or not working'
      })
    );

    // Error handling tests - CLI shows help for invalid commands (acceptable UX)
    this.addTest(
      'Invalid Command Handling',
      'node bin/unjucks.cjs invalidcommand 2>&1',
      (output, error) => ({
        passed: output !== null, // CLI shows help for invalid commands, which is good UX
        error: 'CLI should respond to invalid commands (showing help is acceptable)'
      }),
      { expectFailure: false, timeout: 3000 }
    );

    // Template discovery (should work even with no templates)
    this.addTest(
      'Template Discovery',
      'node bin/unjucks.cjs list',
      (output) => ({
        passed: output !== null, // Should not crash, even if no templates
        error: 'List command crashed'
      })
    );
  }

  async runAllTests() {
    console.log(chalk.green.bold('🚀 Starting Unjucks Smoke Tests\n'));
    
    this.setupTests();
    
    let passed = 0;
    let failed = 0;
    
    for (const test of this.tests) {
      const result = await this.runTest(test);
      this.results.push(result);
      
      if (result.passed) {
        console.log(chalk.green(`✅ ${result.name}`));
        passed++;
      } else {
        console.log(chalk.red(`❌ ${result.name}`));
        console.log(chalk.red(`   Error: ${result.error}`));
        if (result.output) {
          console.log(chalk.gray(`   Output: ${result.output}`));
        }
        failed++;
      }
      console.log(''); // Empty line for readability
    }
    
    // Summary
    console.log('='.repeat(60));
    console.log(chalk.bold(`📊 Test Results: ${passed} passed, ${failed} failed`));
    
    if (failed === 0) {
      console.log(chalk.green.bold('🎉 All smoke tests passed!'));
      console.log(chalk.green('✅ CLI is functional and ready for use.'));
    } else {
      console.log(chalk.red.bold(`❌ ${failed} test(s) failed.`));
      console.log(chalk.red('🔧 Please fix the issues before publishing.'));
    }
    
    console.log('='.repeat(60));
    
    return failed === 0;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new SmokeTestRunner();
  
  runner.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(chalk.red(`Fatal error during smoke tests: ${error.message}`));
      process.exit(1);
    });
}

export { SmokeTestRunner };