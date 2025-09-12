#!/usr/bin/env node

/**
 * Resolver Test Suite Runner
 * 
 * Comprehensive test runner for URI Resolver Charter compliance validation
 * Ensures 99.9% reproducibility and performance targets are met
 */

import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test suite configuration
const TEST_CONFIG = {
  suites: [
    {
      name: 'Content URI Resolver',
      file: 'content-uri-resolver.test.js',
      category: 'unit',
      timeout: 10000,
      required: true
    },
    {
      name: 'Comprehensive URI Resolver',
      file: 'uri-resolver-comprehensive.test.js',
      category: 'charter-compliance',
      timeout: 30000,
      required: true
    },
    {
      name: 'Reproducibility Validation',
      file: 'reproducibility-validation.test.js',
      category: 'reproducibility',
      timeout: 20000,
      required: true
    },
    {
      name: 'Performance Benchmarks',
      file: 'performance-benchmarks.test.js',
      category: 'performance',
      timeout: 30000,
      required: true
    },
    {
      name: 'Security Validation',
      file: 'security-validation.test.js',
      category: 'security',
      timeout: 15000,
      required: true
    },
    {
      name: 'Integration Tests',
      file: 'integration-tests.test.js',
      category: 'integration',
      timeout: 20000,
      required: true
    }
  ],
  
  // Charter compliance requirements
  charter: {
    reproducibilityTarget: 99.9,
    performanceTargets: {
      contentResolution: { avg: 50, max: 100 },
      gitOperations: { avg: 200, max: 400 },
      attestationVerification: { avg: 100, max: 200 },
      driftPatchApplication: { avg: 150, max: 300 }
    },
    coverageTargets: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    }
  },
  
  // Execution modes
  modes: {
    development: {
      reproducibilityRuns: 5,
      performanceIterations: 50,
      enableDebugLogging: true
    },
    ci: {
      reproducibilityRuns: 10,
      performanceIterations: 100,
      enableDebugLogging: false,
      strict: true
    },
    charter: {
      reproducibilityRuns: 10,
      performanceIterations: 100,
      enableDebugLogging: false,
      strict: true,
      generateReport: true
    }
  }
};

class ResolverTestRunner {
  constructor(mode = 'development') {
    this.mode = mode;
    this.config = TEST_CONFIG.modes[mode] || TEST_CONFIG.modes.development;
    this.results = {
      suites: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      charter: {
        compliant: false,
        score: 0,
        details: {}
      }
    };
    this.startTime = this.getDeterministicTimestamp();
  }

  async run() {
    console.log(`🚀 Starting Resolver Test Suite (${this.mode} mode)\n`);
    console.log(`📋 Charter Requirements:`);
    console.log(`   Reproducibility Target: ${TEST_CONFIG.charter.reproducibilityTarget}%`);
    console.log(`   Performance Targets: Content <${TEST_CONFIG.charter.performanceTargets.contentResolution.avg}ms avg`);
    console.log(`   Coverage Targets: Statements >${TEST_CONFIG.charter.coverageTargets.statements}%\n`);

    try {
      // Setup test environment
      await this.setupTestEnvironment();
      
      // Run test suites
      for (const suite of TEST_CONFIG.suites) {
        console.log(`\n🧪 Running ${suite.name}...`);
        const result = await this.runTestSuite(suite);
        this.results.suites[suite.name] = result;
        
        if (result.success) {
          console.log(`✅ ${suite.name}: PASSED (${result.duration}ms)`);
          this.results.summary.passed++;
        } else {
          console.log(`❌ ${suite.name}: FAILED`);
          this.results.summary.failed++;
          
          if (suite.required && this.config.strict) {
            throw new Error(`Required test suite failed: ${suite.name}`);
          }
        }
        
        this.results.summary.total++;
      }
      
      // Validate Charter compliance
      await this.validateCharterCompliance();
      
      // Generate report
      if (this.config.generateReport || this.mode === 'charter') {
        await this.generateReport();
      }
      
      // Print summary
      this.printSummary();
      
      // Exit with appropriate code
      const success = this.results.summary.failed === 0 && 
                     (this.mode !== 'charter' || this.results.charter.compliant);
      process.exit(success ? 0 : 1);
      
    } catch (error) {
      console.error(`\n❌ Test suite execution failed:`, error.message);
      process.exit(1);
    }
  }

  async setupTestEnvironment() {
    console.log('⚙️  Setting up test environment...');
    
    // Set environment variables
    process.env.NODE_ENV = 'test';
    process.env.DETERMINISTIC_TESTS = 'true';
    process.env.REPRODUCIBILITY_RUNS = this.config.reproducibilityRuns.toString();
    process.env.PERFORMANCE_ITERATIONS = this.config.performanceIterations.toString();
    process.env.ENABLE_DEBUG_LOGGING = this.config.enableDebugLogging.toString();
    
    // Ensure test directories exist
    const testDirs = [
      path.join(__dirname, '../reports'),
      path.join(__dirname, '../coverage')
    ];
    
    for (const dir of testDirs) {
      await fs.ensureDir(dir);
    }
    
    console.log('✅ Test environment ready');
  }

  async runTestSuite(suite) {
    const startTime = this.getDeterministicTimestamp();
    
    return new Promise((resolve) => {
      const testFile = path.join(__dirname, suite.file);
      const args = [
        'run',
        testFile,
        '--reporter=verbose',
        `--testTimeout=${suite.timeout}`
      ];
      
      if (this.mode === 'charter' || this.mode === 'ci') {
        args.push('--coverage');
      }
      
      const child = spawn('npx', ['vitest', ...args], {
        cwd: path.join(__dirname, '../../..'),
        stdio: this.config.enableDebugLogging ? 'inherit' : 'pipe',
        env: { ...process.env }
      });
      
      let output = '';
      let errorOutput = '';
      
      if (child.stdout) {
        child.stdout.on('data', (data) => {
          output += data.toString();
        });
      }
      
      if (child.stderr) {
        child.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
      }
      
      child.on('close', (code) => {
        const duration = this.getDeterministicTimestamp() - startTime;
        
        resolve({
          success: code === 0,
          code,
          duration,
          output,
          errorOutput,
          category: suite.category
        });
      });
      
      child.on('error', (error) => {
        resolve({
          success: false,
          code: -1,
          duration: this.getDeterministicTimestamp() - startTime,
          output,
          errorOutput: error.message,
          category: suite.category
        });
      });
    });
  }

  async validateCharterCompliance() {
    console.log('\n📋 Validating Charter Compliance...');
    
    const compliance = {
      reproducibility: false,
      performance: false,
      coverage: false,
      security: false,
      uriSchemes: false
    };
    
    // Check reproducibility results
    const reproducibilityResult = this.results.suites['Reproducibility Validation'];
    if (reproducibilityResult && reproducibilityResult.success) {
      compliance.reproducibility = true;
      console.log('✅ Reproducibility: COMPLIANT (≥99.9%)');
    } else {
      console.log('❌ Reproducibility: NON-COMPLIANT');
    }
    
    // Check performance results
    const performanceResult = this.results.suites['Performance Benchmarks'];
    if (performanceResult && performanceResult.success) {
      compliance.performance = true;
      console.log('✅ Performance: COMPLIANT (meets all targets)');
    } else {
      console.log('❌ Performance: NON-COMPLIANT');
    }
    
    // Check security results
    const securityResult = this.results.suites['Security Validation'];
    if (securityResult && securityResult.success) {
      compliance.security = true;
      console.log('✅ Security: COMPLIANT (all tests passed)');
    } else {
      console.log('❌ Security: NON-COMPLIANT');
    }
    
    // Check URI scheme coverage
    const comprehensiveResult = this.results.suites['Comprehensive URI Resolver'];
    if (comprehensiveResult && comprehensiveResult.success) {
      compliance.uriSchemes = true;
      console.log('✅ URI Schemes: COMPLIANT (all schemes tested)');
    } else {
      console.log('❌ URI Schemes: NON-COMPLIANT');
    }
    
    // Check test coverage (if available)
    try {
      const coverageFile = path.join(__dirname, '../coverage/coverage-summary.json');
      if (await fs.pathExists(coverageFile)) {
        const coverage = await fs.readJson(coverageFile);
        const targets = TEST_CONFIG.charter.coverageTargets;
        
        const coverageCompliant = 
          coverage.total.statements.pct >= targets.statements &&
          coverage.total.branches.pct >= targets.branches &&
          coverage.total.functions.pct >= targets.functions &&
          coverage.total.lines.pct >= targets.lines;
        
        compliance.coverage = coverageCompliant;
        console.log(`${coverageCompliant ? '✅' : '❌'} Coverage: ${coverageCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'} (${coverage.total.statements.pct}% statements)`);
      }
    } catch (error) {
      console.log('⚠️  Coverage: Unable to determine compliance');
    }
    
    // Calculate overall compliance
    const complianceCount = Object.values(compliance).filter(Boolean).length;
    const totalChecks = Object.keys(compliance).length;
    const complianceScore = (complianceCount / totalChecks) * 100;
    
    this.results.charter = {
      compliant: complianceCount === totalChecks,
      score: complianceScore,
      details: compliance
    };
    
    console.log(`\n📊 Charter Compliance Score: ${complianceScore.toFixed(1)}% (${complianceCount}/${totalChecks})`);
    
    if (this.results.charter.compliant) {
      console.log('🎉 CHARTER COMPLIANT: All requirements met!');
    } else {
      console.log('⚠️  CHARTER NON-COMPLIANT: Some requirements not met');
    }
  }

  async generateReport() {
    console.log('\n📄 Generating test report...');
    
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      mode: this.mode,
      duration: this.getDeterministicTimestamp() - this.startTime,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      configuration: this.config,
      results: this.results,
      charter: TEST_CONFIG.charter
    };
    
    const reportFile = path.join(__dirname, '../reports', `resolver-test-report-${this.getDeterministicTimestamp()}.json`);
    await fs.writeJson(reportFile, report, { spaces: 2 });
    
    console.log(`✅ Report generated: ${reportFile}`);
    
    // Generate HTML report if in charter mode
    if (this.mode === 'charter') {
      await this.generateHTMLReport(report);
    }
  }

  async generateHTMLReport(report) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>URI Resolver Test Suite - Charter Compliance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .compliant { color: #28a745; }
        .non-compliant { color: #dc3545; }
        .suite { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .passed { background: #d4edda; }
        .failed { background: #f8d7da; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
        th { background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="header">
        <h1>URI Resolver Test Suite Report</h1>
        <p><strong>Mode:</strong> ${report.mode}</p>
        <p><strong>Generated:</strong> ${report.timestamp}</p>
        <p><strong>Duration:</strong> ${report.duration}ms</p>
        <p class="${report.results.charter.compliant ? 'compliant' : 'non-compliant'}">
            <strong>Charter Compliance:</strong> ${report.results.charter.compliant ? 'COMPLIANT' : 'NON-COMPLIANT'} (${report.results.charter.score.toFixed(1)}%)
        </p>
    </div>
    
    <h2>Test Suite Results</h2>
    <table>
        <tr>
            <th>Suite</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Category</th>
        </tr>
        ${Object.entries(report.results.suites).map(([name, result]) => `
        <tr class="${result.success ? 'passed' : 'failed'}">
            <td>${name}</td>
            <td>${result.success ? '✅ PASSED' : '❌ FAILED'}</td>
            <td>${result.duration}ms</td>
            <td>${result.category}</td>
        </tr>
        `).join('')}
    </table>
    
    <h2>Charter Compliance Details</h2>
    <table>
        <tr>
            <th>Requirement</th>
            <th>Status</th>
            <th>Target</th>
        </tr>
        <tr class="${report.results.charter.details.reproducibility ? 'passed' : 'failed'}">
            <td>Reproducibility</td>
            <td>${report.results.charter.details.reproducibility ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}</td>
            <td>≥99.9%</td>
        </tr>
        <tr class="${report.results.charter.details.performance ? 'passed' : 'failed'}">
            <td>Performance</td>
            <td>${report.results.charter.details.performance ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}</td>
            <td>All targets met</td>
        </tr>
        <tr class="${report.results.charter.details.security ? 'passed' : 'failed'}">
            <td>Security</td>
            <td>${report.results.charter.details.security ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}</td>
            <td>All tests passed</td>
        </tr>
        <tr class="${report.results.charter.details.uriSchemes ? 'passed' : 'failed'}">
            <td>URI Schemes</td>
            <td>${report.results.charter.details.uriSchemes ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}</td>
            <td>All schemes tested</td>
        </tr>
        <tr class="${report.results.charter.details.coverage ? 'passed' : 'failed'}">
            <td>Test Coverage</td>
            <td>${report.results.charter.details.coverage ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}</td>
            <td>≥80% statements</td>
        </tr>
    </table>
    
    <h2>Summary</h2>
    <p><strong>Total Tests:</strong> ${report.results.summary.total}</p>
    <p><strong>Passed:</strong> ${report.results.summary.passed}</p>
    <p><strong>Failed:</strong> ${report.results.summary.failed}</p>
    <p><strong>Success Rate:</strong> ${((report.results.summary.passed / report.results.summary.total) * 100).toFixed(1)}%</p>
</body>
</html>
    `;
    
    const htmlFile = path.join(__dirname, '../reports', `resolver-test-report-${this.getDeterministicTimestamp()}.html`);
    await fs.writeFile(htmlFile, html);
    console.log(`✅ HTML report generated: ${htmlFile}`);
  }

  printSummary() {
    const { summary, charter } = this.results;
    const duration = this.getDeterministicTimestamp() - this.startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUITE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Duration: ${duration}ms`);
    console.log(`Total Tests: ${summary.total}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Success Rate: ${((summary.passed / summary.total) * 100).toFixed(1)}%`);
    console.log('');
    console.log(`Charter Compliance: ${charter.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'} (${charter.score.toFixed(1)}%)`);
    
    if (charter.compliant) {
      console.log('🎉 All Charter requirements have been met!');
      console.log('📋 The URI Resolver implementation is fully compliant.');
    } else {
      console.log('⚠️  Some Charter requirements need attention.');
      console.log('📋 Review the detailed report for specific issues.');
    }
    
    console.log('='.repeat(60));
  }
}

// CLI interface
const mode = process.argv[2] || 'development';
const validModes = Object.keys(TEST_CONFIG.modes);

if (!validModes.includes(mode)) {
  console.error(`❌ Invalid mode: ${mode}`);
  console.error(`Valid modes: ${validModes.join(', ')}`);
  process.exit(1);
}

const runner = new ResolverTestRunner(mode);
runner.run().catch(console.error);