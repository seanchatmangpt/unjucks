#!/usr/bin/env node

/**
 * KGEN Complete Integration Test Suite
 * 
 * Tests the entire KGEN pipeline end-to-end to validate:
 * - Graph operations (hash, index, diff)
 * - Project lifecycle (lock, attest)
 * - Template and rule management
 * - Error handling and edge cases
 * - Performance under load
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const kgenBin = path.join(projectRoot, 'bin/kgen.mjs');

class KGenIntegrationTester {
  constructor() {
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      performance: {}
    };
  }

  log(message) {
    console.log(`[KGEN-TEST] ${new Date().toISOString()} ${message}`);
  }

  async runCommand(command) {
    try {
      const output = execSync(`node ${kgenBin} ${command}`, { 
        cwd: projectRoot,
        encoding: 'utf8',
        timeout: 30000
      });
      return { success: true, output: output.trim() };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        output: error.stdout || error.stderr || ''
      };
    }
  }

  async testGraphOperations() {
    this.log('Testing Graph Operations...');
    const tests = [
      {
        name: 'Graph Hash - Valid File',
        command: 'graph hash test.ttl',
        expectSuccess: true,
        validate: (output) => {
          const result = JSON.parse(output);
          return result.success && result.hash && result.file;
        }
      },
      {
        name: 'Graph Index - Valid File', 
        command: 'graph index test.ttl',
        expectSuccess: true,
        validate: (output) => {
          const result = JSON.parse(output);
          return result.success && result.triples > 0 && result.subjects;
        }
      },
      {
        name: 'Graph Hash - Non-existent File',
        command: 'graph hash non-existent.ttl',
        expectSuccess: false
      }
    ];

    for (const test of tests) {
      this.testResults.total++;
      const startTime = Date.now();
      const result = await this.runCommand(test.command);
      const duration = Date.now() - startTime;
      
      this.testResults.performance[test.name] = duration;

      if (result.success === test.expectSuccess) {
        if (test.validate && result.success) {
          try {
            if (test.validate(result.output)) {
              this.log(`✅ ${test.name} - PASSED (${duration}ms)`);
              this.testResults.passed++;
            } else {
              this.log(`❌ ${test.name} - FAILED validation`);
              this.testResults.failed++;
              this.testResults.errors.push(`${test.name}: Validation failed`);
            }
          } catch (error) {
            this.log(`❌ ${test.name} - FAILED validation error: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push(`${test.name}: ${error.message}`);
          }
        } else {
          this.log(`✅ ${test.name} - PASSED (${duration}ms)`);
          this.testResults.passed++;
        }
      } else {
        this.log(`❌ ${test.name} - FAILED: Expected success=${test.expectSuccess}, got=${result.success}`);
        this.testResults.failed++;
        this.testResults.errors.push(`${test.name}: ${result.error || 'Unexpected result'}`);
      }
    }
  }

  async testProjectOperations() {
    this.log('Testing Project Operations...');
    const tests = [
      {
        name: 'Project Lock Generation',
        command: 'project lock',
        expectSuccess: true,
        validate: (output) => {
          const result = JSON.parse(output);
          return result.success && result.lockfile && result.filesHashed > 0;
        }
      },
      {
        name: 'Project Attestation',
        command: 'project attest', 
        expectSuccess: true,
        validate: (output) => {
          const result = JSON.parse(output);
          return result.success && result.attestationPath && result.summary;
        }
      }
    ];

    for (const test of tests) {
      this.testResults.total++;
      const startTime = Date.now();
      const result = await this.runCommand(test.command);
      const duration = Date.now() - startTime;

      this.testResults.performance[test.name] = duration;

      if (result.success === test.expectSuccess && (!test.validate || test.validate(result.output))) {
        this.log(`✅ ${test.name} - PASSED (${duration}ms)`);
        this.testResults.passed++;
      } else {
        this.log(`❌ ${test.name} - FAILED`);
        this.testResults.failed++;
        this.testResults.errors.push(`${test.name}: ${result.error || 'Validation failed'}`);
      }
    }
  }

  async testTemplateOperations() {
    this.log('Testing Template Operations...');
    const tests = [
      {
        name: 'Template Listing',
        command: 'templates ls',
        expectSuccess: true,
        validate: (output) => {
          const result = JSON.parse(output);
          return result.success && typeof result.count === 'number';
        }
      }
    ];

    for (const test of tests) {
      this.testResults.total++;
      const startTime = Date.now();
      const result = await this.runCommand(test.command);
      const duration = Date.now() - startTime;

      this.testResults.performance[test.name] = duration;

      if (result.success === test.expectSuccess && (!test.validate || test.validate(result.output))) {
        this.log(`✅ ${test.name} - PASSED (${duration}ms)`);
        this.testResults.passed++;
      } else {
        this.log(`❌ ${test.name} - FAILED`);
        this.testResults.failed++;
        this.testResults.errors.push(`${test.name}: ${result.error || 'Validation failed'}`);
      }
    }
  }

  async testRulesOperations() {
    this.log('Testing Rules Operations...');
    const tests = [
      {
        name: 'Rules Listing',
        command: 'rules ls',
        expectSuccess: true,
        validate: (output) => {
          const result = JSON.parse(output);
          return result.success && Array.isArray(result.rules);
        }
      }
    ];

    for (const test of tests) {
      this.testResults.total++;
      const startTime = Date.now();
      const result = await this.runCommand(test.command);
      const duration = Date.now() - startTime;

      this.testResults.performance[test.name] = duration;

      if (result.success === test.expectSuccess && (!test.validate || test.validate(result.output))) {
        this.log(`✅ ${test.name} - PASSED (${duration}ms)`);
        this.testResults.passed++;
      } else {
        this.log(`❌ ${test.name} - FAILED`);
        this.testResults.failed++;
        this.testResults.errors.push(`${test.name}: ${result.error || 'Validation failed'}`);
      }
    }
  }

  async performanceStressTest() {
    this.log('Running Performance Stress Tests...');
    const iterations = 10;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      await this.runCommand('graph hash test.ttl');
    }

    const totalTime = Date.now() - startTime;
    const avgTime = totalTime / iterations;

    this.testResults.performance['Stress Test - Average Hash Time'] = avgTime;
    this.log(`Performance: ${iterations} iterations in ${totalTime}ms (avg: ${avgTime}ms)`);
  }

  generateReport() {
    const report = {
      testSummary: {
        total: this.testResults.total,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        successRate: `${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`
      },
      errors: this.testResults.errors,
      performance: this.testResults.performance,
      productionReadiness: {
        cliInterface: this.testResults.passed > 0 ? 'WORKING' : 'BROKEN',
        graphOperations: this.testResults.errors.some(e => e.includes('Graph')) ? 'ISSUES' : 'WORKING',
        projectManagement: this.testResults.errors.some(e => e.includes('Project')) ? 'ISSUES' : 'WORKING',
        templateSystem: this.testResults.errors.some(e => e.includes('Template')) ? 'ISSUES' : 'WORKING',
        rulesEngine: this.testResults.errors.some(e => e.includes('Rules')) ? 'ISSUES' : 'WORKING'
      },
      criticalIssues: [
        'Syntax error in content-cache.js (FIXED during test)',
        'Import errors with consola module',
        'Artifact generation not working properly',
        'Drift detection failing due to syntax errors'
      ],
      recommendations: [
        'Fix remaining syntax errors in core modules',
        'Update import statements to match available exports',
        'Add comprehensive error handling for all CLI commands',
        'Implement proper artifact generation workflow',
        'Add integration tests to CI pipeline'
      ]
    };

    return report;
  }

  async run() {
    this.log('Starting KGEN Complete Integration Test Suite');
    this.log(`Testing KGEN binary: ${kgenBin}`);

    try {
      await this.testGraphOperations();
      await this.testProjectOperations(); 
      await this.testTemplateOperations();
      await this.testRulesOperations();
      await this.performanceStressTest();

      const report = this.generateReport();
      
      // Save report
      const reportPath = path.join(projectRoot, 'reports/kgen-integration-test-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      this.log('\n=== KGEN INTEGRATION TEST RESULTS ===');
      this.log(`Total Tests: ${report.testSummary.total}`);
      this.log(`Passed: ${report.testSummary.passed}`);
      this.log(`Failed: ${report.testSummary.failed}`);
      this.log(`Success Rate: ${report.testSummary.successRate}`);
      
      if (report.errors.length > 0) {
        this.log('\nErrors:');
        report.errors.forEach(error => this.log(`  - ${error}`));
      }

      this.log(`\nDetailed report saved to: ${reportPath}`);
      
      return report;

    } catch (error) {
      this.log(`FATAL ERROR: ${error.message}`);
      return {
        fatal: true,
        error: error.message,
        testSummary: this.testResults
      };
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new KGenIntegrationTester();
  tester.run().then(report => {
    process.exit(report.testSummary.failed > 0 ? 1 : 0);
  });
}

export default KGenIntegrationTester;