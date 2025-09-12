#!/usr/bin/env node

/**
 * Clean Room Deployment Test
 * Simulates fresh installation and deployment scenarios
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class CleanRoomDeploymentTester {
  constructor() {
    this.workspaceDir = path.join(os.tmpdir(), `unjucks-clean-room-${this.getDeterministicTimestamp()}`);
    this.results = {
      platform: {
        os: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      },
      tests: {},
      errors: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        overallStatus: 'UNKNOWN'
      }
    };
  }

  async setup() {
    console.log('🧹 Setting up clean room environment...');
    await fs.mkdir(this.workspaceDir, { recursive: true });
    console.log(`Workspace: ${this.workspaceDir}`);
  }

  async testPackageCreation() {
    console.log('\n📦 Testing package creation and structure...');
    const testName = 'package-creation';
    this.results.summary.total++;

    try {
      const originalPackage = await fs.readFile(path.resolve('package.json'), 'utf-8');
      const packageJson = JSON.parse(originalPackage);

      // Validate critical package.json fields
      const requiredFields = ['name', 'version', 'type', 'main', 'bin', 'engines'];
      const missingFields = requiredFields.filter(field => !packageJson[field]);

      // Check engines compatibility
      const nodeEngine = packageJson.engines?.node;
      const currentNodeMajor = parseInt(process.version.slice(1).split('.')[0]);
      const requiredNodeMajor = nodeEngine ? parseInt(nodeEngine.replace('>=', '').split('.')[0]) : 0;

      this.results.tests[testName] = {
        success: missingFields.length === 0 && currentNodeMajor >= requiredNodeMajor,
        packageJson: {
          name: packageJson.name,
          version: packageJson.version,
          type: packageJson.type,
          engines: packageJson.engines,
          requiredFields: requiredFields.length,
          missingFields: missingFields.length,
          nodeCompatible: currentNodeMajor >= requiredNodeMajor
        },
        message: missingFields.length === 0 ? 'Package structure valid' : `Missing fields: ${missingFields.join(', ')}`
      };

      if (missingFields.length === 0 && currentNodeMajor >= requiredNodeMajor) {
        console.log('✅ Package creation: PASSED');
        console.log(`  📋 Name: ${packageJson.name}`);
        console.log(`  🔢 Version: ${packageJson.version}`);
        console.log(`  📦 Type: ${packageJson.type}`);
        console.log(`  ⚙️ Node.js: ${process.version} (requires ${nodeEngine})`);
        this.results.summary.passed++;
      } else {
        console.log('❌ Package creation: FAILED');
        if (missingFields.length > 0) {
          console.log(`  Missing: ${missingFields.join(', ')}`);
        }
        if (currentNodeMajor < requiredNodeMajor) {
          console.log(`  Node.js version incompatible: ${process.version} < ${nodeEngine}`);
        }
        this.results.summary.failed++;
      }
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message
      };
      console.log('❌ Package creation: ERROR -', error.message);
      this.results.summary.failed++;
      this.results.errors.push(`${testName}: ${error.message}`);
    }
  }

  async testMinimalInstallation() {
    console.log('\n⬇️ Testing minimal installation...');
    const testName = 'minimal-installation';
    const testDir = path.join(this.workspaceDir, 'minimal-test');
    this.results.summary.total++;

    try {
      await fs.mkdir(testDir, { recursive: true });

      // Create minimal package.json with only essential dependencies
      const minimalPackage = {
        name: 'unjucks-minimal-test',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          citty: '0.1.6',
          chalk: '4.1.2',
          consola: '3.4.2'
        }
      };

      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(minimalPackage, null, 2)
      );

      console.log('  📦 Installing minimal dependencies...');
      const { stdout, stderr } = await execAsync('npm install --no-audit --no-fund --quiet', {
        cwd: testDir,
        timeout: 120000 // 2 minutes timeout
      });

      // Verify installation
      const nodeModulesPath = path.join(testDir, 'node_modules');
      await fs.access(nodeModulesPath);
      
      // Check if critical dependencies were installed
      const criticalDeps = ['citty', 'chalk', 'consola'];
      const installedDeps = [];
      
      for (const dep of criticalDeps) {
        try {
          await fs.access(path.join(nodeModulesPath, dep));
          installedDeps.push(dep);
        } catch {
          // Dependency not found
        }
      }

      this.results.tests[testName] = {
        success: installedDeps.length === criticalDeps.length,
        installation: {
          totalDeps: criticalDeps.length,
          installedDeps: installedDeps.length,
          dependencies: installedDeps,
          output: stdout.length,
          errors: stderr.length
        },
        message: `${installedDeps.length}/${criticalDeps.length} dependencies installed`
      };

      if (installedDeps.length === criticalDeps.length) {
        console.log('✅ Minimal installation: PASSED');
        console.log(`  📦 Dependencies: ${installedDeps.join(', ')}`);
        this.results.summary.passed++;
      } else {
        console.log('❌ Minimal installation: FAILED');
        console.log(`  Missing: ${criticalDeps.filter(dep => !installedDeps.includes(dep)).join(', ')}`);
        this.results.summary.failed++;
      }
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message
      };
      console.log('❌ Minimal installation: ERROR -', error.message);
      this.results.summary.failed++;
      this.results.errors.push(`${testName}: ${error.message}`);
    }
  }

  async testBinaryDeployment() {
    console.log('\n🔧 Testing binary deployment...');
    const testName = 'binary-deployment';
    const testDir = path.join(this.workspaceDir, 'binary-test');
    this.results.summary.total++;

    try {
      await fs.mkdir(testDir, { recursive: true });

      // Copy binary to test location
      const originalBinary = await fs.readFile(path.resolve('bin/unjucks.cjs'), 'utf-8');
      const testBinaryPath = path.join(testDir, 'unjucks.cjs');
      await fs.writeFile(testBinaryPath, originalBinary);
      await fs.chmod(testBinaryPath, 0o755);

      // Test binary execution
      console.log('  🧪 Testing binary execution...');
      const { stdout: versionOutput } = await execAsync(`node "${testBinaryPath}" --version`, {
        cwd: testDir,
        timeout: 10000
      });

      const { stdout: helpOutput } = await execAsync(`node "${testBinaryPath}" --help`, {
        cwd: testDir,
        timeout: 10000
      });

      // Verify outputs
      const versionMatch = versionOutput.trim().match(/^\d+\.\d+\.\d+/);
      const helpContainsUsage = helpOutput.includes('USAGE:') || helpOutput.includes('unjucks');

      this.results.tests[testName] = {
        success: versionMatch && helpContainsUsage,
        binary: {
          versionOutput: versionOutput.trim(),
          hasVersion: !!versionMatch,
          helpLength: helpOutput.length,
          hasHelp: helpContainsUsage,
          executable: true
        },
        message: 'Binary executes correctly and shows expected output'
      };

      if (versionMatch && helpContainsUsage) {
        console.log('✅ Binary deployment: PASSED');
        console.log(`  📋 Version: ${versionOutput.trim()}`);
        console.log(`  📖 Help: ${helpOutput.length} characters`);
        this.results.summary.passed++;
      } else {
        console.log('❌ Binary deployment: FAILED');
        if (!versionMatch) console.log('  No version output detected');
        if (!helpContainsUsage) console.log('  Help output missing or malformed');
        this.results.summary.failed++;
      }
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message
      };
      console.log('❌ Binary deployment: ERROR -', error.message);
      this.results.summary.failed++;
      this.results.errors.push(`${testName}: ${error.message}`);
    }
  }

  async testModuleResolution() {
    console.log('\n🔍 Testing module resolution...');
    const testName = 'module-resolution';
    const testDir = path.join(this.workspaceDir, 'module-test');
    this.results.summary.total++;

    try {
      await fs.mkdir(testDir, { recursive: true });

      // Create test script for module resolution
      const testScript = `
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Module resolution test:');
console.log('- __dirname:', __dirname);
console.log('- Node.js version:', process.version);
console.log('- Platform:', process.platform);
console.log('- Architecture:', process.arch);

try {
  // Test basic module imports
  const fsPromises = await import('fs/promises');
  console.log('- fs/promises: ✅');
  
  const pathModule = await import('path');
  console.log('- path: ✅');
  
  const osModule = await import('os');
  console.log('- os: ✅');
  
  console.log('SUCCESS: All modules resolved');
  process.exit(0);
} catch (error) {
  console.log('ERROR:', error.message);
  process.exit(1);
}
`;

      const testScriptPath = path.join(testDir, 'test.mjs');
      await fs.writeFile(testScriptPath, testScript);

      // Execute test script
      const { stdout, stderr } = await execAsync(`node "${testScriptPath}"`, {
        cwd: testDir,
        timeout: 10000
      });

      const success = stdout.includes('SUCCESS: All modules resolved') && !stderr.includes('Error');

      this.results.tests[testName] = {
        success,
        modules: {
          output: stdout,
          errors: stderr,
          testExecuted: true
        },
        message: success ? 'All modules resolved successfully' : 'Module resolution failed'
      };

      if (success) {
        console.log('✅ Module resolution: PASSED');
        console.log('  📦 All core modules accessible');
        this.results.summary.passed++;
      } else {
        console.log('❌ Module resolution: FAILED');
        if (stderr) console.log(`  Error: ${stderr}`);
        this.results.summary.failed++;
      }
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message
      };
      console.log('❌ Module resolution: ERROR -', error.message);
      this.results.summary.failed++;
      this.results.errors.push(`${testName}: ${error.message}`);
    }
  }

  async testEnvironmentCompatibility() {
    console.log('\n🌍 Testing environment compatibility...');
    const testName = 'environment-compatibility';
    this.results.summary.total++;

    try {
      // Test various environment scenarios
      const envTests = {
        tempDirectory: {
          test: async () => {
            const tempFile = path.join(os.tmpdir(), `unjucks-env-test-${this.getDeterministicTimestamp()}.txt`);
            await fs.writeFile(tempFile, 'test');
            await fs.unlink(tempFile);
            return true;
          },
          description: 'Temp directory write/delete'
        },
        environmentVars: {
          test: async () => {
            return !!(process.env.PATH && (process.env.HOME || process.env.USERPROFILE));
          },
          description: 'Essential environment variables'
        },
        processPermissions: {
          test: async () => {
            return process.getuid !== undefined ? process.getuid() >= 0 : true;
          },
          description: 'Process permissions'
        },
        fileSystemAccess: {
          test: async () => {
            const currentDir = process.cwd();
            const testFile = path.join(currentDir, 'package.json');
            await fs.access(testFile);
            return true;
          },
          description: 'File system read access'
        }
      };

      const results = {};
      let passedTests = 0;

      for (const [testKey, testConfig] of Object.entries(envTests)) {
        try {
          const result = await testConfig.test();
          results[testKey] = { success: result, description: testConfig.description };
          if (result) passedTests++;
          console.log(`  ${result ? '✅' : '❌'} ${testConfig.description}`);
        } catch (error) {
          results[testKey] = { success: false, description: testConfig.description, error: error.message };
          console.log(`  ❌ ${testConfig.description}: ${error.message}`);
        }
      }

      const totalEnvTests = Object.keys(envTests).length;
      const success = passedTests === totalEnvTests;

      this.results.tests[testName] = {
        success,
        environment: {
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
          tempDir: os.tmpdir(),
          currentDir: process.cwd(),
          totalTests: totalEnvTests,
          passedTests,
          tests: results
        },
        message: `${passedTests}/${totalEnvTests} environment tests passed`
      };

      if (success) {
        console.log('✅ Environment compatibility: PASSED');
        this.results.summary.passed++;
      } else {
        console.log('❌ Environment compatibility: FAILED');
        this.results.summary.failed++;
      }
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message
      };
      console.log('❌ Environment compatibility: ERROR -', error.message);
      this.results.summary.failed++;
      this.results.errors.push(`${testName}: ${error.message}`);
    }
  }

  async generateReport() {
    this.results.summary.overallStatus = this.results.summary.failed === 0 ? 'PASSED' : 'FAILED';
    
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      ...this.results
    };

    const reportPath = path.join(this.workspaceDir, 'clean-room-deployment-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log('\n🏗️ Clean Room Deployment Report');
    console.log('='.repeat(45));
    console.log(`Platform: ${report.platform.os} ${report.platform.arch}`);
    console.log(`Node.js: ${report.platform.nodeVersion}`);
    console.log(`Total Tests: ${report.summary.total}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Success Rate: ${Math.round((report.summary.passed / report.summary.total) * 100)}%`);
    console.log(`Overall Status: ${report.summary.overallStatus}`);

    if (report.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      report.errors.forEach(error => {
        console.log(`  • ${error}`);
      });
    }

    console.log(`\n📋 Detailed report: ${reportPath}`);
    return report;
  }

  async cleanup() {
    try {
      await fs.rm(this.workspaceDir, { recursive: true, force: true });
      console.log(`\n🧹 Cleaned up workspace: ${this.workspaceDir}`);
    } catch (error) {
      console.warn(`Warning: Cleanup failed - ${error.message}`);
    }
  }

  async run() {
    try {
      await this.setup();
      
      await this.testPackageCreation();
      await this.testMinimalInstallation();
      await this.testBinaryDeployment();
      await this.testModuleResolution();
      await this.testEnvironmentCompatibility();
      
      const report = await this.generateReport();
      return report.summary.overallStatus === 'PASSED';
    } finally {
      await this.cleanup();
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new CleanRoomDeploymentTester();
  
  tester.run()
    .then(success => {
      console.log(`\n🎯 Clean room deployment testing ${success ? 'PASSED' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(`\n💥 Clean room deployment testing failed: ${error.message}`);
      process.exit(1);
    });
}

export { CleanRoomDeploymentTester };