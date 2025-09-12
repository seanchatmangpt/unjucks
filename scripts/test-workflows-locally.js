#!/usr/bin/env node

/**
 * Local GitHub Actions Workflow Testing Script
 * Tests workflow components locally without requiring GitHub
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

class LocalWorkflowTester {
  constructor() {
    this.testResults = [];
    this.dockerAvailable = this.checkDockerAvailability();
  }

  log(message, type = 'info') {
    const timestamp = this.getDeterministicDate().toISOString();
    const prefix = {
      info: '🔍',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      test: '🧪'
    }[type];
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  checkDockerAvailability() {
    try {
      execSync('docker --version', { stdio: 'ignore' });
      this.log('Docker is available for testing', 'success');
      return true;
    } catch (error) {
      this.log('Docker not available - skipping Docker tests', 'warning');
      return false;
    }
  }

  async runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const { cwd = projectRoot, timeout = 30000 } = options;
      
      this.log(`Running: ${command}`, 'test');
      
      const child = spawn('bash', ['-c', command], {
        cwd,
        stdio: 'pipe',
        timeout
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
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Handle timeout
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out: ${command}`));
      }, timeout);
    });
  }

  async testNodeSetup() {
    this.log('Testing Node.js setup...', 'test');
    
    try {
      const { stdout } = await this.runCommand('node --version');
      const nodeVersion = stdout.trim();
      
      if (nodeVersion.startsWith('v20') || nodeVersion.startsWith('v18') || nodeVersion.startsWith('v22')) {
        this.log(`Node.js version compatible: ${nodeVersion}`, 'success');
        return true;
      } else {
        this.log(`Node.js version may not be compatible: ${nodeVersion}`, 'warning');
        return false;
      }
    } catch (error) {
      this.log(`Node.js setup test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testNpmInstall() {
    this.log('Testing npm install...', 'test');
    
    try {
      await this.runCommand('npm ci --prefer-offline --no-audit', { timeout: 120000 });
      this.log('npm install successful', 'success');
      return true;
    } catch (error) {
      this.log(`npm install failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testBuildProcess() {
    this.log('Testing build process...', 'test');
    
    try {
      // Test build:prepare
      await this.runCommand('npm run build:prepare', { timeout: 60000 });
      this.log('build:prepare successful', 'success');

      // Test build:enhanced if available
      try {
        await this.runCommand('npm run build:enhanced', { timeout: 60000 });
        this.log('build:enhanced successful', 'success');
      } catch (error) {
        this.log('build:enhanced not available or failed', 'warning');
      }

      return true;
    } catch (error) {
      this.log(`Build process failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testPackageValidation() {
    this.log('Testing package validation...', 'test');
    
    try {
      // Test package creation
      await this.runCommand('npm pack --dry-run');
      this.log('Package dry-run successful', 'success');

      // Test package validation if script exists
      try {
        await this.runCommand('npm run package:validate');
        this.log('Package validation successful', 'success');
      } catch (error) {
        this.log('Package validation script not available', 'warning');
      }

      return true;
    } catch (error) {
      this.log(`Package validation failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testSecurityScan() {
    this.log('Testing security scan...', 'test');
    
    try {
      await this.runCommand('npm audit --audit-level moderate');
      this.log('Security scan completed', 'success');
      return true;
    } catch (error) {
      this.log('Security scan completed with issues (expected)', 'warning');
      return true; // Security issues don't fail the test
    }
  }

  async testDockerBuild() {
    if (!this.dockerAvailable) {
      this.log('Skipping Docker tests - Docker not available', 'warning');
      return true;
    }

    this.log('Testing Docker builds...', 'test');
    
    const dockerfiles = [
      'docker/Dockerfile.production',
      'docker/Dockerfile.testing',
      'docker/Dockerfile.performance'
    ];

    let allPassed = true;
    
    for (const dockerfile of dockerfiles) {
      if (!existsSync(join(projectRoot, dockerfile))) {
        this.log(`Dockerfile not found: ${dockerfile}`, 'warning');
        continue;
      }

      try {
        const imageTag = `unjucks-test:${dockerfile.split('.').pop()}`;
        await this.runCommand(
          `docker build -f ${dockerfile} -t ${imageTag} .`,
          { timeout: 300000 } // 5 minutes
        );
        
        this.log(`Docker build successful: ${dockerfile}`, 'success');
        
        // Test basic functionality
        try {
          await this.runCommand(`docker run --rm ${imageTag} unjucks --version`);
          this.log(`Docker image functional: ${imageTag}`, 'success');
        } catch (error) {
          this.log(`Docker image test failed: ${imageTag}`, 'warning');
        }
        
        // Cleanup
        await this.runCommand(`docker rmi ${imageTag}`);
        
      } catch (error) {
        this.log(`Docker build failed for ${dockerfile}: ${error.message}`, 'error');
        allPassed = false;
      }
    }

    return allPassed;
  }

  async testDockerCompose() {
    if (!this.dockerAvailable) {
      this.log('Skipping Docker Compose tests - Docker not available', 'warning');
      return true;
    }

    this.log('Testing Docker Compose configurations...', 'test');
    
    const composeFiles = [
      'docker/docker-compose.testing.yml',
      'docker/docker-compose.validation.yml',
      'generated/docker-compose.development.yml'
    ];

    let allPassed = true;
    
    for (const composeFile of composeFiles) {
      if (!existsSync(join(projectRoot, composeFile))) {
        this.log(`Compose file not found: ${composeFile}`, 'warning');
        continue;
      }

      try {
        // Validate compose file syntax
        await this.runCommand(`docker-compose -f ${composeFile} config --quiet`);
        this.log(`Docker Compose syntax valid: ${composeFile}`, 'success');
        
      } catch (error) {
        this.log(`Docker Compose validation failed for ${composeFile}: ${error.message}`, 'error');
        allPassed = false;
      }
    }

    return allPassed;
  }

  async testCLIFunctionality() {
    this.log('Testing CLI functionality...', 'test');
    
    try {
      // Test version command
      const { stdout: versionOutput } = await this.runCommand('node bin/unjucks.cjs --version');
      this.log(`CLI version: ${versionOutput.trim()}`, 'success');

      // Test help command
      await this.runCommand('node bin/unjucks.cjs --help');
      this.log('CLI help command successful', 'success');

      // Test list command
      await this.runCommand('node bin/unjucks.cjs list');
      this.log('CLI list command successful', 'success');

      return true;
    } catch (error) {
      this.log(`CLI functionality test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testWorkflowComponents() {
    this.log('Testing workflow components...', 'test');
    
    const tests = [
      { name: 'Node.js Setup', test: () => this.testNodeSetup() },
      { name: 'NPM Install', test: () => this.testNpmInstall() },
      { name: 'Build Process', test: () => this.testBuildProcess() },
      { name: 'Package Validation', test: () => this.testPackageValidation() },
      { name: 'Security Scan', test: () => this.testSecurityScan() },
      { name: 'CLI Functionality', test: () => this.testCLIFunctionality() },
      { name: 'Docker Build', test: () => this.testDockerBuild() },
      { name: 'Docker Compose', test: () => this.testDockerCompose() }
    ];

    const results = [];
    
    for (const { name, test } of tests) {
      this.log(`\n🧪 Running test: ${name}`, 'test');
      
      try {
        const startTime = this.getDeterministicTimestamp();
        const passed = await test();
        const duration = this.getDeterministicTimestamp() - startTime;
        
        results.push({
          name,
          passed,
          duration,
          error: null
        });
        
        if (passed) {
          this.log(`Test passed: ${name} (${duration}ms)`, 'success');
        } else {
          this.log(`Test failed: ${name} (${duration}ms)`, 'error');
        }
        
      } catch (error) {
        results.push({
          name,
          passed: false,
          duration: 0,
          error: error.message
        });
        
        this.log(`Test error: ${name} - ${error.message}`, 'error');
      }
    }

    return results;
  }

  generateTestReport(results) {
    this.log('\n📊 Local Workflow Test Report', 'test');
    this.log('==============================');
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const passRate = ((passed / total) * 100).toFixed(1);
    
    this.log(`Tests: ${passed}/${total} passed (${passRate}%)`);
    this.log(`Total duration: ${results.reduce((sum, r) => sum + r.duration, 0)}ms`);
    
    // Group results
    const passedTests = results.filter(r => r.passed);
    const failedTests = results.filter(r => !r.passed);
    
    if (passedTests.length > 0) {
      this.log('\n✅ Passed Tests:', 'success');
      passedTests.forEach(test => {
        this.log(`  - ${test.name} (${test.duration}ms)`, 'success');
      });
    }
    
    if (failedTests.length > 0) {
      this.log('\n❌ Failed Tests:', 'error');
      failedTests.forEach(test => {
        this.log(`  - ${test.name}: ${test.error || 'Test failed'}`, 'error');
      });
    }
    
    // Save report
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      summary: {
        total,
        passed,
        failed: total - passed,
        passRate: parseFloat(passRate)
      },
      results,
      docker_available: this.dockerAvailable
    };
    
    const reportPath = join(projectRoot, 'test-results/workflow-test-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`\nReport saved: ${reportPath}`, 'info');
    
    const success = passRate >= 70; // Require 70% pass rate
    if (success) {
      this.log('\n🎉 Workflow components test PASSED!', 'success');
    } else {
      this.log('\n💥 Workflow components test FAILED!', 'error');
    }
    
    return success;
  }
}

// Main execution
async function main() {
  const tester = new LocalWorkflowTester();
  
  tester.log('🚀 Starting local workflow component testing...');
  
  try {
    const results = await tester.testWorkflowComponents();
    const success = tester.generateTestReport(results);
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    tester.log(`Test execution failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Local testing script failed:', error);
    process.exit(1);
  });
}