#!/usr/bin/env node

/**
 * KGEN v1 Comprehensive Test Runner
 * Executes all BDD tests for v1 functionality validation
 */

import { spawn } from 'child_process';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = join(fileURLToPath(import.meta.url), '..');

class V1TestRunner {
  constructor() {
    this.startTime = Date.now();
    this.results = new Map();
    this.reportDir = join(__dirname, 'reports');
  }

  async initialize() {
    console.log('🚀 Initializing KGEN v1 Test Suite');
    
    // Create reports directory
    await mkdir(this.reportDir, { recursive: true });
    
    // Set environment variables for deterministic testing
    process.env.NODE_ENV = 'test';
    process.env.KGEN_TEST_MODE = 'true';
    process.env.KGEN_DETERMINISTIC = 'true';
    process.env.SOURCE_DATE_EPOCH = '1704067200'; // 2024-01-01 00:00:00 UTC
    process.env.TZ = 'UTC';
    
    console.log('✅ Test environment initialized');
  }

  async runTestProfile(profileName, description) {
    console.log(`\n📋 Running ${description}...`);
    const startTime = Date.now();
    
    try {
      const result = await this.executeCucumber(profileName);
      const duration = Date.now() - startTime;
      
      this.results.set(profileName, {
        profile: profileName,
        description,
        success: result.exitCode === 0,
        duration,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr
      });
      
      if (result.exitCode === 0) {
        console.log(`✅ ${description} completed successfully (${duration}ms)`);
      } else {
        console.log(`❌ ${description} failed (${duration}ms)`);
        console.log(`Exit code: ${result.exitCode}`);
        if (result.stderr) {
          console.log(`Error: ${result.stderr.slice(0, 500)}...`);
        }
      }
      
      return result.exitCode === 0;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`💥 ${description} crashed (${duration}ms)`);
      console.log(`Error: ${error.message}`);
      
      this.results.set(profileName, {
        profile: profileName,
        description,
        success: false,
        duration,
        error: error.message
      });
      
      return false;
    }
  }

  async executeCucumber(profile) {
    return new Promise((resolve, reject) => {
      const args = [
        '--config', 'tests/cucumber.config.cjs',
        '--profile', profile
      ];
      
      const cucumber = spawn('npx', ['cucumber-js', ...args], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      cucumber.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      cucumber.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      cucumber.on('close', (code) => {
        resolve({
          exitCode: code,
          stdout,
          stderr
        });
      });
      
      cucumber.on('error', (error) => {
        reject(error);
      });
      
      // Set timeout
      setTimeout(() => {
        cucumber.kill('SIGTERM');
        reject(new Error('Test timeout'));
      }, 600000); // 10 minute timeout
    });
  }

  async runFullSuite() {
    await this.initialize();
    
    const testProfiles = [
      ['smoke', 'Critical Smoke Tests'],
      ['deterministic', 'Deterministic Generation Tests'],
      ['cas', 'Content Addressed Storage Tests'],
      ['attestation', 'Attestation Generation Tests'],
      ['marketplace', 'Marketplace Publish/Install Tests'],
      ['shacl', 'SHACL Validation Tests'],
      ['git-receipts', 'Git Receipts Ledger Tests'],
      ['personas', 'Persona Exploration Tests'],
      ['fuzz', 'Fuzz Testing Suite'],
      ['performance', 'Performance Benchmarks'],
      ['kpi', 'KPI Validation Tests']
    ];
    
    console.log('\n🎯 KGEN v1 Comprehensive Test Suite');
    console.log('=====================================');
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const [profile, description] of testProfiles) {
      const success = await this.runTestProfile(profile, description);
      if (success) {
        totalPassed++;
      } else {
        totalFailed++;
      }
    }
    
    // Generate final report
    await this.generateSummaryReport();
    
    const totalDuration = Date.now() - this.startTime;
    console.log('\n📊 FINAL RESULTS');
    console.log('================');
    console.log(`Total test profiles: ${testProfiles.length}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Success rate: ${((totalPassed / testProfiles.length) * 100).toFixed(1)}%`);
    console.log(`Total duration: ${(totalDuration / 1000).toFixed(1)}s`);
    
    if (totalFailed === 0) {
      console.log('\n🎉 ALL v1 TESTS PASSED! KGEN v1 is ready for release.');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed. v1 requirements not met.');
      process.exit(1);
    }
  }

  async runQuickValidation() {
    await this.initialize();
    
    console.log('\n⚡ Quick v1 Validation');
    console.log('=====================');
    
    const quickTests = [
      ['smoke', 'Critical Functionality'],
      ['deterministic', 'Deterministic Generation'],
      ['cas', 'CAS Storage'],
      ['attestation', 'Attestation Generation']
    ];
    
    let allPassed = true;
    
    for (const [profile, description] of quickTests) {
      const success = await this.runTestProfile(profile, description);
      if (!success) {
        allPassed = false;
      }
    }
    
    await this.generateSummaryReport();
    
    if (allPassed) {
      console.log('\n✅ Quick validation passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Quick validation failed!');
      process.exit(1);
    }
  }

  async generateSummaryReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - this.startTime,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        sourceEpoch: process.env.SOURCE_DATE_EPOCH
      },
      results: Array.from(this.results.values()),
      summary: {
        total: this.results.size,
        passed: Array.from(this.results.values()).filter(r => r.success).length,
        failed: Array.from(this.results.values()).filter(r => !r.success).length
      }
    };
    
    report.summary.successRate = ((report.summary.passed / report.summary.total) * 100).toFixed(1);
    
    const reportPath = join(this.reportDir, 'v1-test-summary.json');
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    await writeFile(join(this.reportDir, 'v1-test-summary.md'), markdownReport);
    
    console.log(`\n📄 Reports generated:`);
    console.log(`  - ${reportPath}`);
    console.log(`  - ${join(this.reportDir, 'v1-test-summary.md')}`);
  }

  generateMarkdownReport(report) {
    const { results, summary, environment } = report;
    
    let markdown = `# KGEN v1 Test Results\n\n`;
    markdown += `**Generated:** ${report.timestamp}\n`;
    markdown += `**Duration:** ${(report.totalDuration / 1000).toFixed(1)}s\n\n`;
    
    markdown += `## Summary\n\n`;
    markdown += `- **Total Profiles:** ${summary.total}\n`;
    markdown += `- **Passed:** ${summary.passed}\n`;
    markdown += `- **Failed:** ${summary.failed}\n`;
    markdown += `- **Success Rate:** ${summary.successRate}%\n\n`;
    
    markdown += `## Environment\n\n`;
    markdown += `- **Node.js:** ${environment.node}\n`;
    markdown += `- **Platform:** ${environment.platform}\n`;
    markdown += `- **Architecture:** ${environment.arch}\n`;
    markdown += `- **SOURCE_DATE_EPOCH:** ${environment.sourceEpoch}\n\n`;
    
    markdown += `## Detailed Results\n\n`;
    markdown += `| Profile | Description | Status | Duration | Details |\n`;
    markdown += `|---------|-------------|--------|----------|----------|\n`;
    
    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration}ms`;
      const details = result.error ? `Error: ${result.error}` : 
                     result.exitCode !== undefined ? `Exit: ${result.exitCode}` : '-';
      
      markdown += `| ${result.profile} | ${result.description} | ${status} | ${duration} | ${details} |\n`;
    });
    
    markdown += `\n## v1 Requirements Status\n\n`;
    
    const requirements = [
      { name: 'Deterministic Generation', profile: 'deterministic', required: true },
      { name: 'CAS Storage with BLAKE3', profile: 'cas', required: true },
      { name: 'Attestation Generation', profile: 'attestation', required: true },
      { name: 'Marketplace Publishing', profile: 'marketplace', required: true },
      { name: 'SHACL Validation', profile: 'shacl', required: true },
      { name: 'Git Receipts Ledger', profile: 'git-receipts', required: true },
      { name: 'Persona Exploration', profile: 'personas', required: true },
      { name: 'Fuzz Testing Coverage', profile: 'fuzz', required: false },
      { name: 'Performance Benchmarks', profile: 'performance', required: false }
    ];
    
    const criticalFailures = [];
    
    requirements.forEach(req => {
      const result = results.find(r => r.profile === req.profile);
      const status = result?.success ? '✅' : '❌';
      const required = req.required ? ' (REQUIRED)' : ' (Optional)';
      
      markdown += `- ${status} ${req.name}${required}\n`;
      
      if (req.required && !result?.success) {
        criticalFailures.push(req.name);
      }
    });
    
    if (criticalFailures.length > 0) {
      markdown += `\n## ❌ Critical Failures\n\n`;
      markdown += `The following required features failed testing:\n\n`;
      criticalFailures.forEach(failure => {
        markdown += `- ${failure}\n`;
      });
      markdown += `\n**KGEN v1 is NOT ready for release until these issues are resolved.**\n`;
    } else {
      markdown += `\n## 🎉 v1 Release Readiness\n\n`;
      markdown += `All critical v1 requirements have been validated!\n`;
      markdown += `KGEN v1 is ready for release.\n`;
    }
    
    return markdown;
  }
}

// CLI interface
async function main() {
  const runner = new V1TestRunner();
  const mode = process.argv[2] || 'full';
  
  switch (mode) {
    case 'quick':
    case 'smoke':
      await runner.runQuickValidation();
      break;
    case 'full':
    case 'complete':
    default:
      await runner.runFullSuite();
      break;
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export default V1TestRunner;