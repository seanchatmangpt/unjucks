#!/usr/bin/env node

/**
 * CI Test Runner - Orchestrates test execution for GitHub Actions
 * Handles test discovery, coordination hooks, and result aggregation
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Test suite configurations
const TEST_SUITES = {
  unit: {
    config: 'vitest.ci.config.js',
    include: ['tests/unit/**/*.test.js'],
    timeout: 30000,
    description: 'Unit tests with mocks and isolation'
  },
  integration: {
    config: 'vitest.ci.config.js', 
    include: ['tests/integration/**/*.test.js'],
    timeout: 60000,
    description: 'Integration tests with real dependencies'
  },
  smoke: {
    config: 'vitest.ci.config.js',
    include: ['tests/smoke/**/*.test.js', 'tests/*smoke*.test.js'],
    timeout: 20000,
    description: 'Smoke tests for core functionality'
  },
  security: {
    config: 'vitest.ci.config.js',
    include: ['tests/security/**/*.test.js'],
    timeout: 45000,
    description: 'Security and vulnerability tests'
  },
  performance: {
    config: 'vitest.ci.config.js',
    include: ['tests/performance/**/*.test.js'],
    timeout: 120000,
    description: 'Performance and load tests'
  },
  regression: {
    config: 'vitest.ci.config.js',
    include: ['tests/regression/**/*.test.js'],
    timeout: 45000,
    description: 'Regression tests for fixed issues'
  }
};

class CITestRunner {
  constructor() {
    this.results = {
      suite: null,
      startTime: new Date(),
      endTime: null,
      duration: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      coverage: null,
      failures: [],
      coordination: {
        hooksAvailable: false,
        sessionId: null
      }
    };
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = [
      'reports',
      'reports/junit',
      'reports/coverage',
      'reports/artifacts',
      'coverage'
    ];
    
    dirs.forEach(dir => {
      const fullPath = join(rootDir, dir);
      if (!existsSync(fullPath)) {
        mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  async initializeCoordination(suite) {
    console.log(`🎯 Initializing coordination for ${suite} tests...`);
    
    try {
      const sessionId = `ci-${Date.now()}-${suite}`;
      this.results.coordination.sessionId = sessionId;
      
      execSync(
        `npx claude-flow@alpha hooks pre-task --description "CI ${suite} test execution"`,
        { stdio: 'pipe', timeout: 5000 }
      );
      
      this.results.coordination.hooksAvailable = true;
      console.log('✅ Coordination hooks initialized');
    } catch (error) {
      console.log('⚠️  Coordination hooks unavailable, continuing...');
      this.results.coordination.hooksAvailable = false;
    }
  }

  async discoverTests(suite) {
    const config = TEST_SUITES[suite];
    if (!config) {
      throw new Error(`Unknown test suite: ${suite}`);
    }

    console.log(`🔍 Discovering ${suite} tests...`);
    console.log(`   Include patterns: ${config.include.join(', ')}`);
    
    try {
      // Count test files
      const globPattern = config.include.join(' ');
      const testFiles = execSync(
        `find tests/ -name "*.test.js" | grep -E "(${config.include.map(p => p.replace('tests/', '').replace('/**/*.test.js', '')).join('|')})" | wc -l`,
        { encoding: 'utf8', cwd: rootDir }
      ).trim();
      
      console.log(`   Found approximately ${testFiles} test files`);
      
      if (this.results.coordination.hooksAvailable) {
        execSync(
          `npx claude-flow@alpha hooks notify --message "Discovered ${testFiles} test files for ${suite} suite"`,
          { stdio: 'pipe', timeout: 5000 }
        );
      }
      
      return parseInt(testFiles) || 0;
    } catch (error) {
      console.log(`⚠️  Test discovery failed: ${error.message}`);
      return 0;
    }
  }

  async runTestSuite(suite) {
    const config = TEST_SUITES[suite];
    this.results.suite = suite;
    
    console.log(`\n🧪 Running ${suite} test suite`);
    console.log(`   Description: ${config.description}`);
    console.log(`   Timeout: ${config.timeout}ms`);
    
    const testCommand = [
      'npx', 'vitest', 'run',
      '--config', config.config,
      '--reporter=json',
      '--reporter=junit', 
      '--reporter=verbose',
      `--outputFile.json=reports/${suite}-results.json`,
      `--outputFile.junit=reports/junit/${suite}-results.xml`,
      '--coverage'
    ];

    // Add test file patterns
    testCommand.push(...config.include);

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const testProcess = spawn(testCommand[0], testCommand.slice(1), {
        cwd: rootDir,
        stdio: ['inherit', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          CI: 'true',
          TEST_TYPE: suite
        }
      });

      let stdout = '';
      let stderr = '';

      testProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        process.stdout.write(output);
      });

      testProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(output);
      });

      testProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        this.results.duration = duration;
        this.results.endTime = new Date();
        
        console.log(`\n⏱️  ${suite} tests completed in ${duration}ms`);
        
        // Parse results if available
        this.parseTestResults(suite);
        
        if (code === 0) {
          console.log(`✅ ${suite} tests passed`);
          resolve({ success: true, code, stdout, stderr });
        } else {
          console.log(`❌ ${suite} tests failed with code ${code}`);
          resolve({ success: false, code, stdout, stderr });
        }
      });

      testProcess.on('error', (error) => {
        console.log(`💥 ${suite} test process error:`, error);
        reject(error);
      });

      // Timeout handling
      setTimeout(() => {
        testProcess.kill('SIGKILL');
        reject(new Error(`${suite} tests timed out after ${config.timeout}ms`));
      }, config.timeout);
    });
  }

  parseTestResults(suite) {
    const resultsFile = join(rootDir, 'reports', `${suite}-results.json`);
    
    try {
      if (existsSync(resultsFile)) {
        const results = JSON.parse(readFileSync(resultsFile, 'utf8'));
        
        this.results.totalTests = results.numTotalTests || 0;
        this.results.passedTests = results.numPassedTests || 0;
        this.results.failedTests = results.numFailedTests || 0;
        this.results.skippedTests = results.numPendingTests || 0;
        
        if (results.testResults) {
          this.results.failures = results.testResults
            .filter(test => test.status === 'failed')
            .map(test => ({
              name: test.name || test.title,
              message: test.message,
              location: test.location
            }));
        }
        
        console.log(`📊 Results: ${this.results.passedTests}/${this.results.totalTests} passed`);
        if (this.results.failedTests > 0) {
          console.log(`   Failed tests: ${this.results.failedTests}`);
        }
      }
    } catch (error) {
      console.log(`⚠️  Could not parse test results: ${error.message}`);
    }
  }

  async generateReport() {
    console.log('\n📊 Generating comprehensive test report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      suite: this.results.suite,
      execution: {
        startTime: this.results.startTime.toISOString(),
        endTime: this.results.endTime?.toISOString(),
        duration: this.results.duration
      },
      results: {
        total: this.results.totalTests,
        passed: this.results.passedTests,
        failed: this.results.failedTests,
        skipped: this.results.skippedTests,
        successRate: this.results.totalTests > 0 
          ? (this.results.passedTests / this.results.totalTests * 100).toFixed(2)
          : 0
      },
      failures: this.results.failures,
      coordination: this.results.coordination,
      environment: {
        node: process.version,
        platform: process.platform,
        ci: process.env.CI === 'true',
        runner: 'GitHub Actions'
      }
    };

    const reportFile = join(rootDir, 'reports', `${this.results.suite}-report.json`);
    writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`✅ Report saved to ${reportFile}`);
    
    return report;
  }

  async finalizeCoordination() {
    if (this.results.coordination.hooksAvailable) {
      try {
        execSync(
          `npx claude-flow@alpha hooks post-task --task-id "${this.results.coordination.sessionId}"`,
          { stdio: 'pipe', timeout: 5000 }
        );
        
        execSync(
          `npx claude-flow@alpha hooks session-end --export-metrics true`,
          { stdio: 'pipe', timeout: 5000 }
        );
        
        console.log('✅ Coordination finalized');
      } catch (error) {
        console.log('⚠️  Coordination finalization failed');
      }
    }
  }

  async run(suite = 'unit') {
    console.log(`\n🚀 Starting CI test runner for ${suite} suite\n`);
    
    try {
      await this.initializeCoordination(suite);
      await this.discoverTests(suite);
      const result = await this.runTestSuite(suite);
      const report = await this.generateReport();
      await this.finalizeCoordination();
      
      console.log('\n🎉 CI test run completed successfully');
      
      return {
        success: result.success,
        report,
        exitCode: result.code
      };
      
    } catch (error) {
      console.error('\n💥 CI test run failed:', error);
      await this.finalizeCoordination();
      
      return {
        success: false,
        error: error.message,
        exitCode: 1
      };
    }
  }
}

// CLI interface
async function main() {
  const suite = process.argv[2] || 'unit';
  
  if (!TEST_SUITES[suite]) {
    console.error(`❌ Unknown test suite: ${suite}`);
    console.log('Available suites:', Object.keys(TEST_SUITES).join(', '));
    process.exit(1);
  }
  
  const runner = new CITestRunner();
  const result = await runner.run(suite);
  
  process.exit(result.exitCode);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { CITestRunner, TEST_SUITES };