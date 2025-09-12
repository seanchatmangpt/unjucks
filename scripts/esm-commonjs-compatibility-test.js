#!/usr/bin/env node

/**
 * ESM/CommonJS Compatibility Test
 * Tests module system compatibility across different environments
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class ESMCompatibilityTester {
  constructor() {
    this.workspaceDir = path.join(os.tmpdir(), `unjucks-esm-test-${this.getDeterministicTimestamp()}`);
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
    console.log('🔧 Setting up ESM/CommonJS compatibility testing...');
    await fs.mkdir(this.workspaceDir, { recursive: true });
    console.log(`Workspace: ${this.workspaceDir}`);
  }

  async testESMSupport() {
    console.log('\n📦 Testing ESM support...');
    const testName = 'esm-support';
    const testDir = path.join(this.workspaceDir, 'esm-test');
    this.results.summary.total++;

    try {
      await fs.mkdir(testDir, { recursive: true });

      // Create package.json with type: module
      const esmPackage = {
        name: 'esm-test',
        version: '1.0.0',
        type: 'module'
      };

      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(esmPackage, null, 2)
      );

      // Create ESM test script
      const esmScript = `
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('ESM Test Results:');
console.log('✅ ES modules working');
console.log('✅ import.meta.url:', import.meta.url);
console.log('✅ __filename:', __filename);
console.log('✅ __dirname:', __dirname);
console.log('✅ Dynamic imports available');

try {
  const dynamicModule = await import('os');
  console.log('✅ Dynamic import successful:', typeof dynamicModule.platform);
  console.log('SUCCESS');
} catch (error) {
  console.log('❌ Dynamic import failed:', error.message);
  process.exit(1);
}
`;

      await fs.writeFile(path.join(testDir, 'test.js'), esmScript);

      // Run ESM test
      const { stdout, stderr } = await execAsync('node test.js', {
        cwd: testDir,
        timeout: 10000
      });

      const success = stdout.includes('SUCCESS') && !stderr.includes('Error');

      this.results.tests[testName] = {
        success,
        esm: {
          output: stdout,
          errors: stderr,
          hasImportMeta: stdout.includes('import.meta.url'),
          hasDynamicImport: stdout.includes('Dynamic import successful'),
          moduleType: 'module'
        },
        message: success ? 'ESM imports and features work correctly' : 'ESM support incomplete'
      };

      if (success) {
        console.log('✅ ESM support: PASSED');
        console.log('  📦 import/export syntax supported');
        console.log('  🔗 import.meta.url available');
        console.log('  ⚡ Dynamic imports working');
        this.results.summary.passed++;
      } else {
        console.log('❌ ESM support: FAILED');
        if (stderr) console.log(`  Error: ${stderr}`);
        this.results.summary.failed++;
      }
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message
      };
      console.log('❌ ESM support: ERROR -', error.message);
      this.results.summary.failed++;
      this.results.errors.push(`${testName}: ${error.message}`);
    }
  }

  async testCommonJSInterop() {
    console.log('\n🔄 Testing CommonJS interoperability...');
    const testName = 'commonjs-interop';
    const testDir = path.join(this.workspaceDir, 'commonjs-test');
    this.results.summary.total++;

    try {
      await fs.mkdir(testDir, { recursive: true });

      // Create package.json with type: module (for ESM)
      const esmPackage = {
        name: 'commonjs-interop-test',
        version: '1.0.0',
        type: 'module'
      };

      await fs.writeFile(
        path.join(testDir, 'package.json'),
        JSON.stringify(esmPackage, null, 2)
      );

      // Create CommonJS-style module
      const commonjsModule = `
// This is a CommonJS-style module
const testValue = 'CommonJS module works';
const testFunction = () => 'CommonJS function works';

module.exports = {
  testValue,
  testFunction
};
`;

      await fs.writeFile(path.join(testDir, 'commonjs-module.cjs'), commonjsModule);

      // Create ESM script that imports CommonJS
      const interopScript = `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const require = createRequire(__filename);

console.log('CommonJS Interoperability Test:');

try {
  // Test requiring CommonJS module from ESM
  const commonjsModule = require('./commonjs-module.cjs');
  console.log('✅ CommonJS require from ESM:', commonjsModule.testValue);
  console.log('✅ CommonJS function call:', commonjsModule.testFunction());
  
  // Test built-in Node.js modules
  const path = require('path');
  console.log('✅ Built-in CommonJS module:', typeof path.join);
  
  console.log('SUCCESS');
} catch (error) {
  console.log('❌ CommonJS interop failed:', error.message);
  process.exit(1);
}
`;

      await fs.writeFile(path.join(testDir, 'interop-test.js'), interopScript);

      // Run interop test
      const { stdout, stderr } = await execAsync('node interop-test.js', {
        cwd: testDir,
        timeout: 10000
      });

      const success = stdout.includes('SUCCESS') && !stderr.includes('Error');

      this.results.tests[testName] = {
        success,
        interop: {
          output: stdout,
          errors: stderr,
          canRequireFromESM: stdout.includes('CommonJS require from ESM'),
          canCallCommonJSFunctions: stdout.includes('CommonJS function call'),
          canRequireBuiltins: stdout.includes('Built-in CommonJS module')
        },
        message: success ? 'CommonJS interoperability works correctly' : 'CommonJS interop failed'
      };

      if (success) {
        console.log('✅ CommonJS interoperability: PASSED');
        console.log('  🔄 createRequire() working');
        console.log('  📦 Can import CommonJS modules');
        console.log('  ⚙️ Built-in modules accessible');
        this.results.summary.passed++;
      } else {
        console.log('❌ CommonJS interoperability: FAILED');
        if (stderr) console.log(`  Error: ${stderr}`);
        this.results.summary.failed++;
      }
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message
      };
      console.log('❌ CommonJS interoperability: ERROR -', error.message);
      this.results.summary.failed++;
      this.results.errors.push(`${testName}: ${error.message}`);
    }
  }

  async testProjectModuleResolution() {
    console.log('\n🔍 Testing project module resolution...');
    const testName = 'project-module-resolution';
    this.results.summary.total++;

    try {
      // Test importing from project's package.json structure
      const projectRoot = path.resolve('.');
      const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8'));

      // Check module type configuration
      const moduleType = packageJson.type;
      const hasExports = !!packageJson.exports;
      const hasMain = !!packageJson.main;
      const hasBin = !!packageJson.bin;

      // Test if main entry points exist
      const mainExists = hasMain ? await fs.access(path.join(projectRoot, packageJson.main)).then(() => true).catch(() => false) : false;
      const binExists = hasBin ? await fs.access(path.join(projectRoot, packageJson.bin.unjucks)).then(() => true).catch(() => false) : false;

      // Test exports resolution
      let exportsValid = true;
      if (hasExports && packageJson.exports['.']) {
        const exportPath = packageJson.exports['.'].import || packageJson.exports['.'];
        if (typeof exportPath === 'string') {
          exportsValid = await fs.access(path.join(projectRoot, exportPath)).then(() => true).catch(() => false);
        }
      }

      this.results.tests[testName] = {
        success: moduleType === 'module' && (mainExists || exportsValid) && binExists,
        project: {
          moduleType,
          hasExports,
          hasMain,
          hasBin,
          mainExists,
          binExists,
          exportsValid,
          packageName: packageJson.name,
          version: packageJson.version
        },
        message: 'Project module configuration analysis complete'
      };

      if (moduleType === 'module' && (mainExists || exportsValid) && binExists) {
        console.log('✅ Project module resolution: PASSED');
        console.log(`  📦 Type: ${moduleType}`);
        console.log(`  📄 Main: ${mainExists ? '✅' : '❌'}`);
        console.log(`  🚀 Exports: ${exportsValid ? '✅' : '❌'}`);
        console.log(`  🔧 Binary: ${binExists ? '✅' : '❌'}`);
        this.results.summary.passed++;
      } else {
        console.log('❌ Project module resolution: FAILED');
        console.log(`  Type: ${moduleType} (expected: module)`);
        console.log(`  Main exists: ${mainExists}`);
        console.log(`  Exports valid: ${exportsValid}`);
        console.log(`  Binary exists: ${binExists}`);
        this.results.summary.failed++;
      }
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message
      };
      console.log('❌ Project module resolution: ERROR -', error.message);
      this.results.summary.failed++;
      this.results.errors.push(`${testName}: ${error.message}`);
    }
  }

  async testNodeVersionCompatibility() {
    console.log('\n🔢 Testing Node.js version compatibility...');
    const testName = 'node-version-compatibility';
    this.results.summary.total++;

    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      const minorVersion = parseInt(nodeVersion.slice(1).split('.')[1]);

      // Check ESM support by Node.js version
      const esmFeatureSupport = {
        basicESM: majorVersion >= 14, // Basic ESM support
        stableESM: majorVersion >= 16, // Stable ESM support
        importMeta: majorVersion >= 12 || (majorVersion === 12 && minorVersion >= 20),
        topLevelAwait: majorVersion >= 14 || (majorVersion === 14 && minorVersion >= 8),
        dynamicImport: majorVersion >= 12,
        createRequire: majorVersion >= 12
      };

      // Check package.json engines field
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
      const engineRequirement = packageJson.engines?.node;
      const meetsEngineRequirement = !engineRequirement || majorVersion >= parseInt(engineRequirement.replace('>=', '').split('.')[0]);

      const allFeaturesSupported = Object.values(esmFeatureSupport).every(Boolean);

      this.results.tests[testName] = {
        success: allFeaturesSupported && meetsEngineRequirement,
        nodeVersion: {
          current: nodeVersion,
          majorVersion,
          minorVersion,
          engineRequirement,
          meetsEngineRequirement,
          features: esmFeatureSupport,
          allFeaturesSupported
        },
        message: `Node.js ${nodeVersion} ${allFeaturesSupported ? 'fully supports' : 'has limited support for'} required ESM features`
      };

      if (allFeaturesSupported && meetsEngineRequirement) {
        console.log('✅ Node.js version compatibility: PASSED');
        console.log(`  📋 Version: ${nodeVersion}`);
        console.log(`  ⚙️ Engine requirement: ${engineRequirement || 'none'}`);
        console.log('  🔧 All ESM features supported');
        this.results.summary.passed++;
      } else {
        console.log('❌ Node.js version compatibility: FAILED');
        console.log(`  Version: ${nodeVersion}`);
        console.log(`  Engine requirement met: ${meetsEngineRequirement}`);
        console.log('  Missing features:', Object.entries(esmFeatureSupport)
          .filter(([_, supported]) => !supported)
          .map(([feature, _]) => feature)
          .join(', '));
        this.results.summary.failed++;
      }
    } catch (error) {
      this.results.tests[testName] = {
        success: false,
        error: error.message
      };
      console.log('❌ Node.js version compatibility: ERROR -', error.message);
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

    const reportPath = path.join(this.workspaceDir, 'esm-commonjs-compatibility-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log('\n🔧 ESM/CommonJS Compatibility Report');
    console.log('='.repeat(42));
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
      
      await this.testESMSupport();
      await this.testCommonJSInterop();
      await this.testProjectModuleResolution();
      await this.testNodeVersionCompatibility();
      
      const report = await this.generateReport();
      return report.summary.overallStatus === 'PASSED';
    } finally {
      await this.cleanup();
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ESMCompatibilityTester();
  
  tester.run()
    .then(success => {
      console.log(`\n🎯 ESM/CommonJS compatibility testing ${success ? 'PASSED' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error(`\n💥 ESM/CommonJS compatibility testing failed: ${error.message}`);
      process.exit(1);
    });
}

export { ESMCompatibilityTester };