#!/usr/bin/env node

/**
 * Multi-Node Version Testing Script
 * Tests unjucks across multiple Node.js versions using Docker
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const NODE_VERSIONS = ['18', '20', '22'];
const TEST_SCENARIOS = [
  'basic-cli',
  'help-command',
  'version-command',
  'list-command',
  'generate-command'
];

class MultiNodeTester {
  constructor() {
    this.results = new Map();
    this.workspaceDir = path.join(os.tmpdir(), `unjucks-multi-node-test-${Date.now()}`);
  }

  async setup() {
    console.log('🚀 Setting up multi-Node.js version testing...');
    await fs.mkdir(this.workspaceDir, { recursive: true });
    console.log(`Test workspace: ${this.workspaceDir}`);
  }

  async testNodeVersion(version) {
    console.log(`\n🧪 Testing Node.js ${version}...`);
    const results = {
      version,
      platform: os.platform(),
      arch: os.arch(),
      tests: new Map(),
      errors: []
    };

    try {
      // Check if Docker is available
      await execAsync('docker --version');
      
      // Test with Docker container
      for (const scenario of TEST_SCENARIOS) {
        try {
          console.log(`  ➤ Running scenario: ${scenario}`);
          const result = await this.runDockerTest(version, scenario);
          results.tests.set(scenario, result);
          console.log(`    ✅ ${scenario}: ${result.success ? 'PASSED' : 'FAILED'}`);
        } catch (error) {
          console.log(`    ❌ ${scenario}: ERROR - ${error.message}`);
          results.tests.set(scenario, {
            success: false,
            error: error.message,
            output: '',
            exitCode: 1
          });
          results.errors.push(`${scenario}: ${error.message}`);
        }
      }
    } catch (dockerError) {
      console.log(`  ⚠️ Docker not available, testing with local Node.js ${process.version}`);
      
      // Fallback to local testing if Docker not available
      if (process.version.startsWith(`v${version}`)) {
        for (const scenario of TEST_SCENARIOS) {
          try {
            console.log(`  ➤ Running scenario: ${scenario}`);
            const result = await this.runLocalTest(scenario);
            results.tests.set(scenario, result);
            console.log(`    ✅ ${scenario}: ${result.success ? 'PASSED' : 'FAILED'}`);
          } catch (error) {
            console.log(`    ❌ ${scenario}: ERROR - ${error.message}`);
            results.tests.set(scenario, {
              success: false,
              error: error.message,
              output: '',
              exitCode: 1
            });
            results.errors.push(`${scenario}: ${error.message}`);
          }
        }
      } else {
        console.log(`  ⏭️ Skipping Node.js ${version} (current: ${process.version})`);
        results.tests.set('skipped', {
          success: false,
          error: `Node.js ${version} not available locally`,
          output: '',
          exitCode: 0
        });
      }
    }

    this.results.set(version, results);
    return results;
  }

  async runDockerTest(nodeVersion, scenario) {
    const projectRoot = path.resolve(process.cwd());
    const dockerCommand = this.getDockerCommand(nodeVersion, scenario);
    
    return new Promise((resolve, reject) => {
      const child = spawn('docker', dockerCommand.split(' ').slice(1), {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          exitCode: code,
          output: stdout,
          error: stderr,
          command: dockerCommand
        });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Set timeout
      setTimeout(() => {
        child.kill();
        reject(new Error('Docker test timeout'));
      }, 30000);
    });
  }

  async runLocalTest(scenario) {
    const projectRoot = path.resolve(process.cwd());
    const command = this.getLocalCommand(scenario);
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: projectRoot,
        timeout: 15000
      });
      
      return {
        success: true,
        exitCode: 0,
        output: stdout,
        error: stderr,
        command
      };
    } catch (error) {
      return {
        success: false,
        exitCode: error.code || 1,
        output: error.stdout || '',
        error: error.stderr || error.message,
        command
      };
    }
  }

  getDockerCommand(nodeVersion, scenario) {
    const commands = {
      'basic-cli': `docker run --rm -v "$(pwd)":/app -w /app node:${nodeVersion}-alpine node bin/unjucks.cjs`,
      'help-command': `docker run --rm -v "$(pwd)":/app -w /app node:${nodeVersion}-alpine node bin/unjucks.cjs --help`,
      'version-command': `docker run --rm -v "$(pwd)":/app -w /app node:${nodeVersion}-alpine node bin/unjucks.cjs --version`,
      'list-command': `docker run --rm -v "$(pwd)":/app -w /app node:${nodeVersion}-alpine node bin/unjucks.cjs list`,
      'generate-command': `docker run --rm -v "$(pwd)":/app -w /app node:${nodeVersion}-alpine node bin/unjucks.cjs help`
    };
    
    return commands[scenario] || commands['basic-cli'];
  }

  getLocalCommand(scenario) {
    const binaryPath = path.resolve('bin/unjucks.cjs');
    const commands = {
      'basic-cli': `node "${binaryPath}"`,
      'help-command': `node "${binaryPath}" --help`,
      'version-command': `node "${binaryPath}" --version`,
      'list-command': `node "${binaryPath}" list`,
      'generate-command': `node "${binaryPath}" help`
    };
    
    return commands[scenario] || commands['basic-cli'];
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      platform: {
        os: os.platform(),
        arch: os.arch(),
        currentNode: process.version
      },
      testResults: {},
      summary: {
        totalVersions: NODE_VERSIONS.length,
        testedVersions: this.results.size,
        totalScenarios: TEST_SCENARIOS.length,
        overallStatus: 'UNKNOWN'
      }
    };

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const [version, results] of this.results) {
      const versionReport = {
        version: results.version,
        platform: results.platform,
        arch: results.arch,
        scenarios: {},
        errors: results.errors,
        summary: {
          total: results.tests.size,
          passed: 0,
          failed: 0,
          status: 'UNKNOWN'
        }
      };

      for (const [scenario, result] of results.tests) {
        versionReport.scenarios[scenario] = result;
        totalTests++;
        if (result.success) {
          versionReport.summary.passed++;
          passedTests++;
        } else {
          versionReport.summary.failed++;
          failedTests++;
        }
      }

      versionReport.summary.status = versionReport.summary.failed === 0 ? 'PASSED' : 'FAILED';
      report.testResults[version] = versionReport;
    }

    report.summary.totalTests = totalTests;
    report.summary.passedTests = passedTests;
    report.summary.failedTests = failedTests;
    report.summary.overallStatus = failedTests === 0 ? 'PASSED' : 'FAILED';

    // Save detailed report
    const reportPath = path.join(this.workspaceDir, 'multi-node-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Generate summary
    console.log('\n📊 Multi-Node.js Version Test Report');
    console.log('='.repeat(50));
    console.log(`Platform: ${report.platform.os} ${report.platform.arch}`);
    console.log(`Current Node.js: ${report.platform.currentNode}`);
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Overall Status: ${report.summary.overallStatus}`);
    console.log(`Report saved to: ${reportPath}`);
    
    console.log('\n📈 Version Breakdown:');
    for (const [version, versionReport] of Object.entries(report.testResults)) {
      console.log(`  Node.js ${version}: ${versionReport.summary.passed}/${versionReport.summary.total} passed (${versionReport.summary.status})`);
      
      if (versionReport.errors.length > 0) {
        console.log(`    Errors: ${versionReport.errors.length}`);
        versionReport.errors.forEach(error => {
          console.log(`      - ${error}`);
        });
      }
    }

    return report;
  }

  async cleanup() {
    try {
      await fs.rm(this.workspaceDir, { recursive: true, force: true });
      console.log(`\n🧹 Cleaned up test workspace: ${this.workspaceDir}`);
    } catch (error) {
      console.warn(`Warning: Failed to cleanup test workspace: ${error.message}`);
    }
  }

  async run() {
    try {
      await this.setup();
      
      console.log(`Testing across Node.js versions: ${NODE_VERSIONS.join(', ')}`);
      console.log(`Test scenarios: ${TEST_SCENARIOS.join(', ')}`);
      
      for (const version of NODE_VERSIONS) {
        await this.testNodeVersion(version);
      }
      
      const report = await this.generateReport();
      
      return report.summary.overallStatus === 'PASSED';
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MultiNodeTester();
  
  tester.run()
    .then(success => {
      console.log(`\n🎯 Multi-Node.js testing ${success ? 'PASSED' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(`\n💥 Multi-Node.js testing failed: ${error.message}`);
      process.exit(1);
    });
}

export { MultiNodeTester };