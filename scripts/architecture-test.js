#!/usr/bin/env node

/**
 * Architecture-Specific Testing Script
 * Tests unjucks on different CPU architectures (x64, arm64)
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const ARCHITECTURES = ['x64', 'arm64', 'arm'];
const NATIVE_PACKAGES = ['bcrypt'];

class ArchitectureTester {
  constructor() {
    this.results = new Map();
    this.currentArch = os.arch();
    this.workspaceDir = path.join(os.tmpdir(), `unjucks-arch-test-${Date.now()}`);
  }

  async setup() {
    console.log('🏗️ Setting up architecture-specific testing...');
    console.log(`Current architecture: ${this.currentArch}`);
    await fs.mkdir(this.workspaceDir, { recursive: true });
  }

  async testCurrentArchitecture() {
    console.log(`\n🔧 Testing current architecture: ${this.currentArch}`);
    
    const results = {
      architecture: this.currentArch,
      platform: os.platform(),
      nodeVersion: process.version,
      tests: new Map(),
      errors: []
    };

    // Test basic functionality
    try {
      const basicTest = await this.runBasicFunctionality();
      results.tests.set('basic-functionality', basicTest);
      console.log(`  ✅ Basic functionality: ${basicTest.success ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
      results.errors.push(`Basic functionality: ${error.message}`);
      console.log(`  ❌ Basic functionality: ERROR`);
    }

    // Test native dependencies
    for (const pkg of NATIVE_PACKAGES) {
      try {
        const nativeTest = await this.testNativeDependency(pkg);
        results.tests.set(`native-${pkg}`, nativeTest);
        console.log(`  ${nativeTest.success ? '✅' : '❌'} Native dependency ${pkg}: ${nativeTest.success ? 'PASSED' : 'FAILED'}`);
      } catch (error) {
        results.errors.push(`Native dependency ${pkg}: ${error.message}`);
        console.log(`  ❌ Native dependency ${pkg}: ERROR`);
      }
    }

    // Test binary execution
    try {
      const binaryTest = await this.testBinaryExecution();
      results.tests.set('binary-execution', binaryTest);
      console.log(`  ✅ Binary execution: ${binaryTest.success ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
      results.errors.push(`Binary execution: ${error.message}`);
      console.log(`  ❌ Binary execution: ERROR`);
    }

    // Test package installation
    try {
      const installTest = await this.testPackageInstallation();
      results.tests.set('package-installation', installTest);
      console.log(`  ✅ Package installation: ${installTest.success ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
      results.errors.push(`Package installation: ${error.message}`);
      console.log(`  ❌ Package installation: ERROR`);
    }

    this.results.set(this.currentArch, results);
    return results;
  }

  async testEmulatedArchitectures() {
    console.log('\n🔄 Testing emulated architectures...');
    
    for (const arch of ARCHITECTURES) {
      if (arch === this.currentArch) {
        console.log(`  ⏭️ Skipping ${arch} (current architecture)`);
        continue;
      }

      console.log(`\n🧪 Testing emulated architecture: ${arch}`);
      
      try {
        // Check if we can test this architecture
        if (await this.canTestArchitecture(arch)) {
          const results = await this.testArchitectureWithDocker(arch);
          this.results.set(arch, results);
          console.log(`  ✅ ${arch}: Testing completed`);
        } else {
          console.log(`  ⏭️ ${arch}: Emulation not available`);
        }
      } catch (error) {
        console.log(`  ❌ ${arch}: Testing failed - ${error.message}`);
        this.results.set(arch, {
          architecture: arch,
          platform: os.platform(),
          nodeVersion: 'unknown',
          tests: new Map([['emulation-error', {
            success: false,
            error: error.message,
            output: '',
            command: ''
          }]]),
          errors: [error.message]
        });
      }
    }
  }

  async canTestArchitecture(arch) {
    try {
      // Try to run a simple Docker command with the specified architecture
      await execAsync(`docker info --format json`);
      
      // Check if buildx is available for multi-arch support
      await execAsync('docker buildx version');
      return true;
    } catch {
      return false;
    }
  }

  async testArchitectureWithDocker(arch) {
    const results = {
      architecture: arch,
      platform: os.platform(),
      nodeVersion: 'docker',
      tests: new Map(),
      errors: []
    };

    const platformTag = arch === 'arm64' ? 'linux/arm64' : `linux/${arch}`;
    
    try {
      // Test basic Node.js functionality
      const basicCommand = `docker run --rm --platform=${platformTag} -v "$(pwd)":/app -w /app node:18-alpine node --version`;
      const basicResult = await this.runDockerCommand(basicCommand, 'node-version');
      results.tests.set('node-version', basicResult);
      
      // Test unjucks binary
      const binaryCommand = `docker run --rm --platform=${platformTag} -v "$(pwd)":/app -w /app node:18-alpine node bin/unjucks.cjs --version`;
      const binaryResult = await this.runDockerCommand(binaryCommand, 'unjucks-binary');
      results.tests.set('unjucks-binary', binaryResult);
      
    } catch (error) {
      results.errors.push(error.message);
    }

    return results;
  }

  async runDockerCommand(command, testName) {
    return new Promise((resolve, reject) => {
      const child = exec(command, { timeout: 30000 });
      
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          exitCode: code,
          output: stdout,
          error: stderr,
          command,
          testName
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          exitCode: 1,
          output: stdout,
          error: error.message,
          command,
          testName
        });
      });
    });
  }

  async runBasicFunctionality() {
    try {
      // Test basic Node.js and package functionality
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
      
      return {
        success: true,
        output: `Package: ${packageJson.name} v${packageJson.version}`,
        error: '',
        command: 'package-json-read'
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error.message,
        command: 'package-json-read'
      };
    }
  }

  async testNativeDependency(packageName) {
    try {
      const module = await import(packageName);
      
      // Test basic functionality for known packages
      if (packageName === 'bcrypt') {
        const hash = await module.hash('test', 10);
        const valid = await module.compare('test', hash);
        
        return {
          success: valid,
          output: `Hash test passed: ${valid}`,
          error: '',
          command: `${packageName}-functionality-test`
        };
      }
      
      return {
        success: !!module,
        output: `${packageName} imported successfully`,
        error: '',
        command: `${packageName}-import-test`
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error.message,
        command: `${packageName}-import-test`
      };
    }
  }

  async testBinaryExecution() {
    try {
      const { stdout } = await execAsync('node bin/unjucks.cjs --version', {
        timeout: 10000
      });
      
      return {
        success: true,
        output: stdout.trim(),
        error: '',
        command: 'binary-version-test'
      };
    } catch (error) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.message,
        command: 'binary-version-test'
      };
    }
  }

  async testPackageInstallation() {
    const testDir = path.join(this.workspaceDir, 'install-test');
    
    try {
      await fs.mkdir(testDir, { recursive: true });
      
      // Create minimal package.json
      const testPackage = {
        name: 'unjucks-install-test',
        version: '1.0.0',
        dependencies: {
          'chalk': '^4.1.2',
          'consola': '^3.4.2'
        }
      };
      
      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(testPackage, null, 2)
      );
      
      // Run npm install
      const { stdout, stderr } = await execAsync('npm install --no-audit --no-fund', {
        cwd: testDir,
        timeout: 60000
      });
      
      // Check if node_modules was created
      await fs.access(path.join(testDir, 'node_modules'));
      
      return {
        success: true,
        output: stdout,
        error: stderr,
        command: 'npm-install-test'
      };
    } catch (error) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.message,
        command: 'npm-install-test'
      };
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      currentArchitecture: this.currentArch,
      platform: os.platform(),
      nodeVersion: process.version,
      architectureResults: {},
      summary: {
        totalArchitectures: 0,
        testedArchitectures: 0,
        passedArchitectures: 0,
        failedArchitectures: 0,
        overallStatus: 'UNKNOWN'
      }
    };

    for (const [arch, results] of this.results) {
      const archReport = {
        architecture: results.architecture,
        platform: results.platform,
        nodeVersion: results.nodeVersion,
        tests: {},
        errors: results.errors,
        summary: {
          totalTests: results.tests.size,
          passedTests: 0,
          failedTests: 0,
          status: 'UNKNOWN'
        }
      };

      for (const [testName, result] of results.tests) {
        archReport.tests[testName] = result;
        if (result.success) {
          archReport.summary.passedTests++;
        } else {
          archReport.summary.failedTests++;
        }
      }

      archReport.summary.status = archReport.summary.failedTests === 0 ? 'PASSED' : 'FAILED';
      report.architectureResults[arch] = archReport;
      
      report.summary.totalArchitectures++;
      report.summary.testedArchitectures++;
      if (archReport.summary.status === 'PASSED') {
        report.summary.passedArchitectures++;
      } else {
        report.summary.failedArchitectures++;
      }
    }

    report.summary.overallStatus = report.summary.failedArchitectures === 0 ? 'PASSED' : 'FAILED';

    // Save report
    const reportPath = path.join(this.workspaceDir, 'architecture-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Generate summary
    console.log('\n🏗️ Architecture Test Report');
    console.log('='.repeat(40));
    console.log(`Current Architecture: ${report.currentArchitecture}`);
    console.log(`Platform: ${report.platform}`);
    console.log(`Node.js: ${report.nodeVersion}`);
    console.log(`Tested Architectures: ${report.summary.testedArchitectures}`);
    console.log(`Passed: ${report.summary.passedArchitectures}`);
    console.log(`Failed: ${report.summary.failedArchitectures}`);
    console.log(`Overall Status: ${report.summary.overallStatus}`);
    console.log(`Report saved to: ${reportPath}`);

    console.log('\n📈 Architecture Breakdown:');
    for (const [arch, archReport] of Object.entries(report.architectureResults)) {
      console.log(`  ${arch}: ${archReport.summary.passedTests}/${archReport.summary.totalTests} passed (${archReport.summary.status})`);
      
      if (archReport.errors.length > 0) {
        archReport.errors.forEach(error => {
          console.log(`    ⚠️ ${error}`);
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
      console.warn(`Warning: Failed to cleanup: ${error.message}`);
    }
  }

  async run() {
    try {
      await this.setup();
      
      // Test current architecture
      await this.testCurrentArchitecture();
      
      // Test other architectures if possible
      await this.testEmulatedArchitectures();
      
      const report = await this.generateReport();
      
      return report.summary.overallStatus === 'PASSED';
    } finally {
      await this.cleanup();
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ArchitectureTester();
  
  tester.run()
    .then(success => {
      console.log(`\n🎯 Architecture testing ${success ? 'PASSED' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(`\n💥 Architecture testing failed: ${error.message}`);
      process.exit(1);
    });
}

export { ArchitectureTester };