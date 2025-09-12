#!/usr/bin/env node
/**
 * Security Integration Test Runner with Performance Monitoring
 * 
 * Runs comprehensive security integration tests and collects performance data.
 * Provides detailed reporting on:
 * - End-to-end workflow performance
 * - Concurrent operation handling
 * - Memory usage under stress
 * - Cross-component integration validation
 * 
 * Usage: node scripts/run-security-integration-tests.mjs
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

class SecurityIntegrationTestRunner {
  constructor() {
    this.startTime = performance.now();
    this.results = {
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      testSuites: [],
      performance: {
        operations: [],
        memory: [],
        benchmarks: {}
      },
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0
      },
      errors: []
    };
  }

  async runTests() {
    console.log('🔒 Starting Security Integration Test Suite');
    console.log('=' .repeat(60));
    
    try {
      // Setup test environment
      await this.setupTestEnvironment();
      
      // Run the integration tests
      await this.executeTests();
      
      // Collect performance data
      await this.collectPerformanceData();
      
      // Generate report
      await this.generateReport();
      
      console.log('\n✅ Security Integration Tests Completed Successfully');
      
    } catch (error) {
      console.error('\n❌ Security Integration Tests Failed:', error.message);
      this.results.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    } finally {
      this.results.endTime = new Date().toISOString();
      this.results.duration = performance.now() - this.startTime;
      
      await this.cleanup();
    }
  }

  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');
    
    // Ensure test directories exist
    const testDirs = [
      path.join(projectRoot, 'temp/security-integration'),
      path.join(projectRoot, 'test-results/security'),
      path.join(projectRoot, 'reports/security')
    ];
    
    for (const dir of testDirs) {
      await fs.ensureDir(dir);
    }
    
    // Check required dependencies
    const requiredPackages = [
      'vitest',
      'crypto',
      'fs-extra'
    ];
    
    console.log('📦 Checking required dependencies...');
    for (const pkg of requiredPackages) {
      try {
        await import(pkg);
        console.log(`  ✅ ${pkg}`);
      } catch (error) {
        console.log(`  ❌ ${pkg} - Not available`);
        throw new Error(`Required package not available: ${pkg}`);
      }
    }
  }

  async executeTests() {
    console.log('\n🧪 Executing Security Integration Tests...');
    
    return new Promise((resolve, reject) => {
      const testFile = path.join(projectRoot, 'tests/integration/security-integration.test.js');
      
      // Check if test file exists
      if (!fs.existsSync(testFile)) {
        reject(new Error(`Test file not found: ${testFile}`));
        return;
      }
      
      const vitestProcess = spawn('npx', ['vitest', 'run', testFile, '--reporter=verbose'], {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          VITEST_POOL_THREADS: '1' // Single thread for consistent performance measurement
        }
      });
      
      let stdout = '';
      let stderr = '';
      
      vitestProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Real-time output
        process.stdout.write(output);
        
        // Parse test results
        this.parseTestOutput(output);
      });
      
      vitestProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        
        // Show errors in real-time
        process.stderr.write(output);
      });
      
      vitestProcess.on('close', (code) => {
        console.log(`\n📊 Test execution completed with exit code: ${code}`);
        
        // Store full output
        this.results.testOutput = {
          stdout,
          stderr,
          exitCode: code
        };
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Tests failed with exit code ${code}`));
        }
      });
      
      vitestProcess.on('error', (error) => {
        reject(new Error(`Failed to start test process: ${error.message}`));
      });
    });
  }

  parseTestOutput(output) {
    // Parse test results from vitest output
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Count passed tests
      if (line.includes('✓') || line.includes('PASS')) {
        this.results.summary.passedTests++;
      }
      
      // Count failed tests
      if (line.includes('✗') || line.includes('FAIL')) {
        this.results.summary.failedTests++;
      }
      
      // Count skipped tests
      if (line.includes('SKIP')) {
        this.results.summary.skippedTests++;
      }
      
      // Parse performance data from console logs
      if (line.includes('completed in') && line.includes('ms')) {
        const match = line.match(/(\w+).*completed in ([\d.]+)ms/);
        if (match) {
          this.results.performance.operations.push({
            operation: match[1],
            duration: parseFloat(match[2]),
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Parse memory data
      if (line.includes('Memory increase:')) {
        const match = line.match(/Memory increase: (\d+)MB/);
        if (match) {
          this.results.performance.memory.push({
            increase: parseInt(match[1]),
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  async collectPerformanceData() {
    console.log('\n📊 Collecting additional performance data...');
    
    // System resource usage
    const systemUsage = {
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      platform: process.platform,
      version: process.version,
      arch: process.arch
    };
    
    this.results.systemUsage = systemUsage;
    
    // Calculate test statistics
    this.results.summary.totalTests = 
      this.results.summary.passedTests + 
      this.results.summary.failedTests + 
      this.results.summary.skippedTests;
    
    // Performance analysis
    if (this.results.performance.operations.length > 0) {
      const durations = this.results.performance.operations.map(op => op.duration);
      
      this.results.performance.statistics = {
        totalOperations: durations.length,
        averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        medianDuration: durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)]
      };
    }
    
    console.log('✅ Performance data collection completed');
  }

  async generateReport() {
    console.log('\n📋 Generating test report...');
    
    const reportData = {
      ...this.results,
      generated: new Date().toISOString(),
      testConfiguration: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: 'test'
      }
    };
    
    // Generate JSON report
    const jsonReportPath = path.join(projectRoot, 'reports/security/integration-test-results.json');
    await fs.writeFile(jsonReportPath, JSON.stringify(reportData, null, 2));
    
    // Generate human-readable report
    const htmlReport = await this.generateHtmlReport(reportData);
    const htmlReportPath = path.join(projectRoot, 'reports/security/integration-test-report.html');
    await fs.writeFile(htmlReportPath, htmlReport);
    
    // Generate summary for console
    this.printTestSummary();
    
    console.log(`\n📄 Reports generated:`);
    console.log(`  JSON: ${jsonReportPath}`);
    console.log(`  HTML: ${htmlReportPath}`);
  }

  async generateHtmlReport(data) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Integration Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .metric { background: white; padding: 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metric h3 { margin: 0 0 5px 0; color: #666; font-size: 14px; }
        .metric .value { font-size: 24px; font-weight: bold; color: #333; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .performance { margin: 20px 0; }
        .operation { padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 4px; }
        pre { background: #f1f1f1; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .timestamp { color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 Security Integration Test Report</h1>
        <p class="timestamp">Generated: ${data.generated}</p>
        <p>Duration: ${(data.duration / 1000).toFixed(2)} seconds</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div class="value">${data.summary.totalTests}</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div class="value passed">${data.summary.passedTests}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div class="value failed">${data.summary.failedTests}</div>
        </div>
        <div class="metric">
            <h3>Success Rate</h3>
            <div class="value">${data.summary.totalTests > 0 ? Math.round((data.summary.passedTests / data.summary.totalTests) * 100) : 0}%</div>
        </div>
    </div>

    ${data.performance.statistics ? `
    <div class="performance">
        <h2>Performance Metrics</h2>
        <div class="summary">
            <div class="metric">
                <h3>Total Operations</h3>
                <div class="value">${data.performance.statistics.totalOperations}</div>
            </div>
            <div class="metric">
                <h3>Average Duration</h3>
                <div class="value">${data.performance.statistics.averageDuration.toFixed(2)}ms</div>
            </div>
            <div class="metric">
                <h3>Min Duration</h3>
                <div class="value">${data.performance.statistics.minDuration.toFixed(2)}ms</div>
            </div>
            <div class="metric">
                <h3>Max Duration</h3>
                <div class="value">${data.performance.statistics.maxDuration.toFixed(2)}ms</div>
            </div>
        </div>
        
        <h3>Operation Details</h3>
        ${data.performance.operations.map(op => `
        <div class="operation">
            <strong>${op.operation}</strong>: ${op.duration.toFixed(2)}ms
            <span class="timestamp">${op.timestamp}</span>
        </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="system-info">
        <h2>System Information</h2>
        <pre>${JSON.stringify(data.testConfiguration, null, 2)}</pre>
        
        <h3>Memory Usage</h3>
        <pre>${JSON.stringify(data.systemUsage.memory, null, 2)}</pre>
    </div>

    ${data.errors.length > 0 ? `
    <div class="errors">
        <h2>Errors</h2>
        ${data.errors.map(error => `
        <div class="error">
            <h4>${error.message}</h4>
            <pre>${error.stack || 'No stack trace available'}</pre>
            <p class="timestamp">${error.timestamp}</p>
        </div>
        `).join('')}
    </div>
    ` : ''}
</body>
</html>`;
    return html;
  }

  printTestSummary() {
    console.log('\n📋 TEST SUMMARY');
    console.log('=' .repeat(40));
    console.log(`Total Tests: ${this.results.summary.totalTests}`);
    console.log(`Passed: ${this.results.summary.passedTests} ✅`);
    console.log(`Failed: ${this.results.summary.failedTests} ${this.results.summary.failedTests > 0 ? '❌' : '✅'}`);
    console.log(`Skipped: ${this.results.summary.skippedTests}`);
    
    const successRate = this.results.summary.totalTests > 0 
      ? Math.round((this.results.summary.passedTests / this.results.summary.totalTests) * 100)
      : 0;
    console.log(`Success Rate: ${successRate}%`);
    
    console.log('\n📊 PERFORMANCE SUMMARY');
    console.log('=' .repeat(40));
    if (this.results.performance.statistics) {
      console.log(`Total Operations: ${this.results.performance.statistics.totalOperations}`);
      console.log(`Average Duration: ${this.results.performance.statistics.averageDuration.toFixed(2)}ms`);
      console.log(`Min Duration: ${this.results.performance.statistics.minDuration.toFixed(2)}ms`);
      console.log(`Max Duration: ${this.results.performance.statistics.maxDuration.toFixed(2)}ms`);
    }
    
    console.log(`\nTotal Test Suite Duration: ${(this.results.duration / 1000).toFixed(2)} seconds`);
    
    if (this.results.performance.memory.length > 0) {
      const totalMemoryIncrease = this.results.performance.memory.reduce((sum, mem) => sum + mem.increase, 0);
      console.log(`Total Memory Usage: ${totalMemoryIncrease}MB`);
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test artifacts...');
    
    // Clean up temporary test files
    const tempDir = path.join(projectRoot, 'temp/security-integration');
    try {
      await fs.remove(tempDir);
      console.log('✅ Temporary files cleaned up');
    } catch (error) {
      console.warn('⚠️  Could not clean up all temporary files:', error.message);
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new SecurityIntegrationTestRunner();
  
  runner.runTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default SecurityIntegrationTestRunner;