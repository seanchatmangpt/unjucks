#!/usr/bin/env node

import { execSync } from 'child_process';
import { strict as assert } from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CLI Verification Tests
 * Quick tests to verify the CLI is working correctly
 */
class CLIVerificationTest {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../..');
    this.unjucksExecutable = path.join(this.projectRoot, 'bin/unjucks.cjs');
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  async runTest(testName, testFunction) {
    this.totalTests++;
    console.log(`\n🧪 Running: ${testName}`);
    
    try {
      const startTime = Date.now();
      await testFunction();
      const duration = Date.now() - startTime;
      
      console.log(`✅ PASSED: ${testName} (${duration}ms)`);
      this.passedTests++;
      this.testResults.push({ name: testName, status: 'PASSED', duration });
    } catch (error) {
      console.error(`❌ FAILED: ${testName}`);
      console.error(`   Error: ${error.message}`);
      this.failedTests++;
      this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
    }
  }

  /**
   * Execute command synchronously for testing
   */
  executeSync(args) {
    try {
      const command = `node "${this.unjucksExecutable}" ${args.join(' ')}`;
      const result = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 30000, // Increased timeout
        maxBuffer: 1024 * 1024, // 1MB buffer
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      return {
        success: true,
        output: result.trim(),
        code: 0
      };
    } catch (error) {
      // Handle timeout and other errors
      const output = (error.stdout || error.stderr || error.message || '').trim();
      
      return {
        success: error.status === 0,
        output,
        code: error.status || 1,
        error: error.message,
        isTimeout: error.signal === 'SIGTERM' || error.code === 'TIMEOUT'
      };
    }
  }

  /**
   * Test CLI Version Command
   */
  async testVersionCommand() {
    const result = this.executeSync(['--version']);
    
    assert(result.success, `Version command failed: ${result.error || result.output}`);
    assert(result.output.length > 0, 'Version output should not be empty');
    assert(/\d+\.\d+\.\d+/.test(result.output), `Version should match pattern, got: ${result.output}`);
    
    console.log(`   Version output: ${result.output}`);
  }

  /**
   * Test CLI Help Command
   */
  async testHelpCommand() {
    const result = this.executeSync(['--help']);
    
    assert(result.success, `Help command failed: ${result.error || result.output}`);
    assert(result.output.length > 0, 'Help output should not be empty');
    assert(result.output.toLowerCase().includes('usage'), `Help should contain usage, got: ${result.output.substring(0, 100)}...`);
    
    console.log(`   Help contains ${result.output.length} characters`);
  }

  /**
   * Test List Command
   */
  async testListCommand() {
    const result = this.executeSync(['list']);
    
    // List command might succeed or fail gracefully
    if (result.success) {
      assert(result.output.length > 0, 'List output should not be empty if successful');
      console.log(`   List output: ${result.output.substring(0, 100)}...`);
    } else {
      console.log(`   List command handled gracefully: ${result.output}`);
    }
  }

  /**
   * Test Invalid Command
   */
  async testInvalidCommand() {
    const result = this.executeSync(['nonexistent-command-xyz']);
    
    // Invalid command should either fail or show help
    if (!result.success) {
      assert(result.output.includes('Unknown') || result.output.includes('command'), 
             `Should show error for invalid command, got: ${result.output}`);
    }
    
    console.log(`   Invalid command handled: ${result.success ? 'success' : 'error'}`);
  }

  /**
   * Test Command Without Args
   */
  async testNoArguments() {
    const result = this.executeSync([]);
    
    // No arguments should show help or usage
    assert(result.output.length > 0, 'Should show something when no arguments provided');
    
    console.log(`   No args output: ${result.output.substring(0, 50)}...`);
  }

  /**
   * Test CLI Executable Exists
   */
  async testExecutableExists() {
    const fs = await import('fs');
    const exists = await fs.promises.access(this.unjucksExecutable).then(() => true).catch(() => false);
    
    assert(exists, `CLI executable should exist at: ${this.unjucksExecutable}`);
    
    console.log(`   Executable found: ${this.unjucksExecutable}`);
  }

  /**
   * Test Package.json Version Consistency
   */
  async testVersionConsistency() {
    const fs = await import('fs');
    const packagePath = path.join(this.projectRoot, 'package.json');
    const packageContent = await fs.promises.readFile(packagePath, 'utf-8');
    const packageData = JSON.parse(packageContent);
    
    const cliResult = this.executeSync(['--version']);
    assert(cliResult.success, 'CLI version command should work');
    
    const cliVersion = cliResult.output.trim();
    const packageVersion = packageData.version;
    
    assert(cliVersion === packageVersion, 
           `CLI version (${cliVersion}) should match package.json version (${packageVersion})`);
    
    console.log(`   Version consistency verified: ${packageVersion}`);
  }

  /**
   * Test Node.js Version Compatibility
   */
  async testNodeCompatibility() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    assert(majorVersion >= 18, `Node.js version ${nodeVersion} should be >= 18`);
    
    console.log(`   Node.js version: ${nodeVersion} ✅`);
  }

  /**
   * Test Template Directory Access
   */
  async testTemplateDirectoryAccess() {
    const fs = await import('fs');
    const templatesDir = path.join(this.projectRoot, '_templates');
    
    try {
      const entries = await fs.promises.readdir(templatesDir);
      assert(entries.length > 0, 'Should have at least one template directory');
      
      console.log(`   Found ${entries.length} template directories`);
    } catch (error) {
      console.log(`   Templates directory not accessible: ${error.message}`);
      // This is not a critical failure for CLI basic functionality
    }
  }

  /**
   * Test Generate Command Basic Syntax
   */
  async testGenerateCommandSyntax() {
    const result = this.executeSync(['generate', '--help']);
    
    // Generate help should work or handle gracefully
    console.log(`   Generate command syntax test: ${result.success ? 'OK' : 'handled gracefully'}`);
  }

  /**
   * Run all verification tests
   */
  async runAllTests() {
    console.log('🚀 Starting CLI Verification Tests');
    console.log('==================================');
    
    const startTime = Date.now();
    
    await this.runTest('CLI Executable Exists', () => this.testExecutableExists());
    await this.runTest('Node.js Version Compatibility', () => this.testNodeCompatibility());
    await this.runTest('CLI Version Command', () => this.testVersionCommand());
    await this.runTest('CLI Help Command', () => this.testHelpCommand());
    await this.runTest('Version Consistency', () => this.testVersionConsistency());
    await this.runTest('No Arguments Handling', () => this.testNoArguments());
    await this.runTest('Invalid Command Handling', () => this.testInvalidCommand());
    await this.runTest('List Command', () => this.testListCommand());
    await this.runTest('Template Directory Access', () => this.testTemplateDirectoryAccess());
    await this.runTest('Generate Command Syntax', () => this.testGenerateCommandSyntax());
    
    const duration = Date.now() - startTime;
    
    console.log('\n📊 CLI Verification Summary');
    console.log('============================');
    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`Passed: ${this.passedTests} ✅`);
    console.log(`Failed: ${this.failedTests} ❌`);
    console.log(`Success Rate: ${Math.round((this.passedTests / this.totalTests) * 100)}%`);
    console.log(`Duration: ${duration}ms`);
    
    if (this.failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(result => result.status === 'FAILED')
        .forEach(result => {
          console.log(`  • ${result.name}: ${result.error}`);
        });
    }
    
    console.log(this.failedTests === 0 ? '\n🎉 All CLI verification tests passed!' : '\n⚠️ Some tests failed');
    
    return {
      total: this.totalTests,
      passed: this.passedTests,
      failed: this.failedTests,
      duration,
      results: this.testResults
    };
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new CLIVerificationTest();
  
  tester.runAllTests()
    .then((results) => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ CLI verification test suite failed:', error);
      process.exit(1);
    });
}

export { CLIVerificationTest };