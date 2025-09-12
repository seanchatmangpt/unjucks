#!/usr/bin/env node

/**
 * Comprehensive CLI Test Suite for Unjucks
 * Tests all CLI commands and documents working vs failing functionality
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class CLITestSuite {
  constructor() {
    this.results = {
      working: [],
      failing: [],
      warnings: [],
      dependencies: { missing: [], installed: [] }
    };
    this.startTime = this.getDeterministicTimestamp();
    this.cliPath = path.resolve(__dirname, '../bin/unjucks.cjs');
  }

  log(message, color = 'gray') {
    console.log(chalk[color](message));
  }

  async runTest(command, description, expectSuccess = true) {
    try {
      const fullCommand = `node ${this.cliPath} ${command}`;
      const result = execSync(fullCommand, { 
        encoding: 'utf8', 
        timeout: 30000,
        stdio: 'pipe'
      });

      const testResult = {
        command: fullCommand,
        description,
        status: 'success',
        output: result.substring(0, 500) + (result.length > 500 ? '...' : ''),
        error: null
      };

      if (expectSuccess) {
        this.results.working.push(testResult);
        this.log(`✅ ${description}`, 'green');
      } else {
        this.results.warnings.push({
          ...testResult,
          status: 'unexpected_success',
          note: 'Expected to fail but succeeded'
        });
        this.log(`⚠️  ${description} (unexpectedly succeeded)`, 'yellow');
      }

      return testResult;
    } catch (error) {
      const testResult = {
        command: `node ${this.cliPath} ${command}`,
        description,
        status: 'failed',
        output: error.stdout || '',
        error: error.stderr || error.message
      };

      if (expectSuccess) {
        this.results.failing.push(testResult);
        this.log(`❌ ${description}`, 'red');
        this.log(`   Error: ${error.message.split('\n')[0]}`, 'red');
      } else {
        testResult.status = 'expected_failure';
        this.results.failing.push(testResult);
        this.log(`🔴 ${description} (expected failure)`, 'yellow');
      }

      return testResult;
    }
  }

  checkDependencies() {
    this.log('\n📦 Checking Dependencies...', 'blue');
    
    const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
    const nodeModulesPath = path.resolve(__dirname, '../node_modules');
    
    for (const [dep, version] of Object.entries(packageJson.dependencies || {})) {
      const depPath = path.join(nodeModulesPath, dep);
      if (fs.existsSync(depPath)) {
        this.results.dependencies.installed.push({ name: dep, version, path: depPath });
        this.log(`✅ ${dep}@${version}`, 'green');
      } else {
        this.results.dependencies.missing.push({ name: dep, version });
        this.log(`❌ ${dep}@${version} - MISSING`, 'red');
      }
    }
  }

  checkFileStructure() {
    this.log('\n📁 Checking File Structure...', 'blue');
    
    const criticalFiles = [
      'bin/unjucks.cjs',
      'src/cli/index.js',
      'package.json',
      '_templates'
    ];

    for (const file of criticalFiles) {
      const filePath = path.resolve(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        this.log(`✅ ${file}`, 'green');
      } else {
        this.log(`❌ ${file} - MISSING`, 'red');
        this.results.failing.push({
          command: 'file-check',
          description: `Critical file missing: ${file}`,
          status: 'missing_file',
          error: `File not found: ${filePath}`
        });
      }
    }
  }

  async runBasicTests() {
    this.log('\n🧪 Running Basic CLI Tests...', 'blue');

    // Basic commands that should work
    await this.runTest('--version', 'Check version flag');
    await this.runTest('--help', 'Check help flag');
    await this.runTest('list', 'List available generators');
    await this.runTest('help', 'Show help command');
    
    // Help for specific commands
    await this.runTest('generate --help', 'Generate command help');
    await this.runTest('init --help', 'Init command help');
    await this.runTest('inject --help', 'Inject command help');
    await this.runTest('semantic --help', 'Semantic command help');
    await this.runTest('github --help', 'GitHub command help');
    await this.runTest('migrate --help', 'Migrate command help');
  }

  async runGenerationTests() {
    this.log('\n🏗️  Running Generation Tests...', 'blue');

    // Test dry runs (should be safe)
    await this.runTest('generate component react TestComponent --dry', 'Dry run generation');
    await this.runTest('component react TestComponent2 --dry', 'Hygen-style dry run');
    
    // Test list with filters
    await this.runTest('list --filter component', 'List component generators', false); // Might not support --filter
    
    // Test generation with different templates
    await this.runTest('generate api endpoint testAPI --dry', 'API endpoint dry run');
    await this.runTest('generate cli citty testCLI --dry', 'CLI generator dry run');
  }

  async runAdvancedTests() {
    this.log('\n🚀 Running Advanced Command Tests...', 'blue');

    // Semantic commands
    await this.runTest('semantic generate --dry', 'Semantic generate dry run', false);
    await this.runTest('semantic validate --help', 'Semantic validate help', false);

    // GitHub integration
    await this.runTest('github analyze --help', 'GitHub analyze help');
    await this.runTest('github pr --help', 'GitHub PR help', false);

    // Init commands
    await this.runTest('init --type react --name test-app --dry', 'Init React project dry run', false);
    
    // Migration commands  
    await this.runTest('migrate --help', 'Migration command help');
  }

  async runErrorCases() {
    this.log('\n🔴 Testing Error Cases...', 'blue');

    // These should fail gracefully
    await this.runTest('nonexistent-command', 'Invalid command', false);
    await this.runTest('generate', 'Generate without arguments', false);
    await this.runTest('generate invalid generator', 'Invalid generator', false);
    await this.runTest('inject', 'Inject without required args', false);
  }

  async testNpmLinkSimulation() {
    this.log('\n🔗 Testing npm link simulation...', 'blue');
    
    try {
      // Test if the CLI can be executed from different directories
      const tempDir = path.resolve(__dirname, '../temp-test');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      
      process.chdir(tempDir);
      const result = execSync(`node ${this.cliPath} --version`, { encoding: 'utf8' });
      
      this.results.working.push({
        command: 'global-simulation',
        description: 'CLI works from different directory (npm link simulation)',
        status: 'success',
        output: result,
        error: null
      });
      
      this.log('✅ npm link simulation successful', 'green');
      
      // Clean up
      process.chdir(path.resolve(__dirname, '..'));
      fs.rmSync(tempDir, { recursive: true, force: true });
      
    } catch (error) {
      this.results.failing.push({
        command: 'global-simulation',
        description: 'CLI fails when run from different directory',
        status: 'failed',
        error: error.message
      });
      this.log('❌ npm link simulation failed', 'red');
    }
  }

  generateReport() {
    this.log('\n📊 Generating Test Report...', 'blue');
    
    const totalTime = this.getDeterministicTimestamp() - this.startTime;
    const totalTests = this.results.working.length + this.results.failing.length;
    
    const report = {
      summary: {
        totalTests,
        working: this.results.working.length,
        failing: this.results.failing.length,
        warnings: this.results.warnings.length,
        successRate: `${((this.results.working.length / totalTests) * 100).toFixed(1)}%`,
        duration: `${totalTime}ms`
      },
      dependencies: this.results.dependencies,
      results: this.results,
      timestamp: this.getDeterministicDate().toISOString()
    };

    // Save detailed report
    const reportPath = path.resolve(__dirname, '../tests/cli-test-results.json');
    if (!fs.existsSync(path.dirname(reportPath))) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Console summary
    this.log('\n🎯 Test Results Summary:', 'bold');
    this.log(`Total Tests: ${totalTests}`, 'white');
    this.log(`✅ Working: ${this.results.working.length}`, 'green');
    this.log(`❌ Failing: ${this.results.failing.length}`, 'red');
    this.log(`⚠️  Warnings: ${this.results.warnings.length}`, 'yellow');
    this.log(`Success Rate: ${report.summary.successRate}`, this.results.working.length > this.results.failing.length ? 'green' : 'red');
    this.log(`Duration: ${totalTime}ms`, 'gray');

    // Critical issues
    if (this.results.dependencies.missing.length > 0) {
      this.log('\n🚨 Missing Dependencies:', 'red');
      this.results.dependencies.missing.forEach(dep => {
        this.log(`  - ${dep.name}@${dep.version}`, 'red');
      });
    }

    // Key findings
    this.log('\n🔍 Key Findings:', 'blue');
    
    const templateErrors = this.results.failing.filter(r => r.error?.includes('unexpected token: %'));
    if (templateErrors.length > 0) {
      this.log('  • Template parsing errors detected (Nunjucks syntax issues)', 'yellow');
    }

    const cittyErrors = this.results.failing.filter(r => r.error?.includes('Cannot find package \'citty\''));
    if (cittyErrors.length > 0) {
      this.log('  • Citty import failures (dependency resolution issues)', 'red');
    }

    const workingShellCommands = this.results.working.filter(r => r.output?.includes('v2025.9.08.1'));
    if (workingShellCommands.length > 0) {
      this.log('  • Shell-based fallback CLI is functional', 'green');
    }

    this.log(`\n📄 Detailed report saved to: ${reportPath}`, 'blue');
    
    return report;
  }

  async run() {
    this.log('🧪 Unjucks CLI Test Suite Starting...', 'bold');
    
    this.checkFileStructure();
    this.checkDependencies();
    
    await this.runBasicTests();
    await this.runGenerationTests();
    await this.runAdvancedTests();
    await this.runErrorCases();
    await this.testNpmLinkSimulation();
    
    return this.generateReport();
  }
}

// Run if called directly
if (require.main === module) {
  const suite = new CLITestSuite();
  suite.run()
    .then(report => {
      const exitCode = report.summary.working >= report.summary.failing ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error(chalk.red('Test suite failed:'), error);
      process.exit(1);
    });
}

module.exports = CLITestSuite;