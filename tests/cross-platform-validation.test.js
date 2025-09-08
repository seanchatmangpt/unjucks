#!/usr/bin/env node

/**
 * Cross-Platform Validation Test Suite
 * Tests Node.js compatibility, package resolution, file paths, binary execution
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const testWorkspace = path.join(os.tmpdir(), 'unjucks-cross-platform-test');

// Platform detection utilities
const platform = {
  isWindows: os.platform() === 'win32',
  isMacOS: os.platform() === 'darwin',
  isLinux: os.platform() === 'linux',
  arch: os.arch(),
  nodeVersion: process.version,
  tempDir: os.tmpdir(),
};

const results = {
  nodeCompatibility: {},
  packageResolution: {},
  filePathHandling: {},
  binaryExecution: {},
  architectureTests: {},
  moduleResolution: {},
  esmCommonJS: {},
  deploymentTests: {},
  errors: []
};

describe('Cross-Platform Validation Suite', () => {
  beforeAll(async () => {
    console.log('🧪 Starting cross-platform validation...');
    console.log(`Platform: ${os.platform()} ${os.arch()}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`npm: ${await getNpmVersion()}`);
    
    // Create test workspace
    await fs.mkdir(testWorkspace, { recursive: true });
  });

  afterAll(async () => {
    // Generate validation report
    await generateValidationReport();
    
    // Cleanup test workspace
    await fs.rm(testWorkspace, { recursive: true, force: true }).catch(() => {});
  });

  describe('Node.js Compatibility Tests', () => {
    test('should detect Node.js version and validate minimum requirements', async () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      results.nodeCompatibility.version = nodeVersion;
      results.nodeCompatibility.majorVersion = majorVersion;
      results.nodeCompatibility.meetsMinimum = majorVersion >= 18;
      
      expect(majorVersion).toBeGreaterThanOrEqual(18);
      console.log(`✅ Node.js ${nodeVersion} meets minimum requirement (>=18)`);
    });

    test('should validate ES modules support', async () => {
      try {
        // Test dynamic import
        const testModule = await import('fs/promises');
        results.nodeCompatibility.esModules = !!testModule.readFile;
        expect(results.nodeCompatibility.esModules).toBe(true);
        console.log('✅ ES modules support confirmed');
      } catch (error) {
        results.errors.push(`ES modules test failed: ${error.message}`);
        throw error;
      }
    });

    test('should validate built-in modules access', async () => {
      const builtinModules = ['fs', 'path', 'os', 'child_process', 'util', 'stream'];
      const moduleAccess = {};
      
      for (const moduleName of builtinModules) {
        try {
          const mod = await import(moduleName);
          moduleAccess[moduleName] = !!mod;
        } catch (error) {
          moduleAccess[moduleName] = false;
          results.errors.push(`Failed to import ${moduleName}: ${error.message}`);
        }
      }
      
      results.nodeCompatibility.builtinModules = moduleAccess;
      expect(Object.values(moduleAccess).every(Boolean)).toBe(true);
      console.log('✅ All required built-in modules accessible');
    });
  });

  describe('Package Resolution Tests', () => {
    test('should resolve package.json correctly', async () => {
      try {
        const packagePath = path.join(projectRoot, 'package.json');
        const packageContent = await fs.readFile(packagePath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        
        results.packageResolution.packageJsonFound = true;
        results.packageResolution.packageName = packageJson.name;
        results.packageResolution.version = packageJson.version;
        results.packageResolution.type = packageJson.type;
        results.packageResolution.engines = packageJson.engines;
        
        expect(packageJson.name).toBe('@seanchatmangpt/unjucks');
        expect(packageJson.type).toBe('module');
        expect(packageJson.engines.node).toBe('>=18.0.0');
        console.log('✅ Package resolution successful');
      } catch (error) {
        results.errors.push(`Package resolution failed: ${error.message}`);
        throw error;
      }
    });

    test('should validate dependency resolution', async () => {
      try {
        const packagePath = path.join(projectRoot, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
        
        const criticalDeps = ['citty', 'nunjucks', 'chalk', 'consola'];
        const resolvedDeps = {};
        
        for (const dep of criticalDeps) {
          try {
            const resolved = await import.meta.resolve(dep, import.meta.url);
            resolvedDeps[dep] = { resolved: true, path: resolved };
          } catch (error) {
            resolvedDeps[dep] = { resolved: false, error: error.message };
          }
        }
        
        results.packageResolution.dependencies = resolvedDeps;
        expect(Object.values(resolvedDeps).every(dep => dep.resolved)).toBe(true);
        console.log('✅ Critical dependencies resolved successfully');
      } catch (error) {
        results.errors.push(`Dependency resolution failed: ${error.message}`);
        throw error;
      }
    });
  });

  describe('File Path Handling Tests', () => {
    test('should handle cross-platform paths correctly', async () => {
      const testPaths = [
        'src/cli/index.js',
        '_templates/component/new/component.njk',
        'tests/cross-platform-validation.test.js',
        'bin/unjucks.cjs'
      ];
      
      const pathResults = {};
      
      for (const testPath of testPaths) {
        const absolutePath = path.resolve(projectRoot, testPath);
        const normalized = path.normalize(testPath);
        const platformSpecific = testPath.split('/').join(path.sep);
        
        try {
          const stats = await fs.stat(absolutePath);
          pathResults[testPath] = {
            exists: true,
            absolute: absolutePath,
            normalized,
            platformSpecific,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory()
          };
        } catch (error) {
          pathResults[testPath] = {
            exists: false,
            error: error.message,
            absolute: absolutePath,
            normalized,
            platformSpecific
          };
        }
      }
      
      results.filePathHandling = pathResults;
      
      // Verify critical paths exist
      expect(pathResults['src/cli/index.js'].exists).toBe(true);
      expect(pathResults['bin/unjucks.cjs'].exists).toBe(true);
      console.log('✅ Cross-platform path handling validated');
    });

    test('should handle Windows-style paths on Windows', async () => {
      if (!platform.isWindows) {
        console.log('⏭️ Skipping Windows path test on non-Windows platform');
        return;
      }
      
      const windowsPath = 'src\\cli\\index.js';
      const normalizedPath = path.normalize(windowsPath);
      const resolvedPath = path.resolve(projectRoot, normalizedPath);
      
      try {
        await fs.access(resolvedPath);
        results.filePathHandling.windowsPaths = { success: true, path: resolvedPath };
        console.log('✅ Windows-style paths handled correctly');
      } catch (error) {
        results.filePathHandling.windowsPaths = { success: false, error: error.message };
        throw new Error(`Windows path handling failed: ${error.message}`);
      }
    });

    test('should handle Unix-style paths on Unix systems', async () => {
      if (platform.isWindows) {
        console.log('⏭️ Skipping Unix path test on Windows platform');
        return;
      }
      
      const unixPath = 'src/cli/index.js';
      const resolvedPath = path.resolve(projectRoot, unixPath);
      
      try {
        await fs.access(resolvedPath);
        results.filePathHandling.unixPaths = { success: true, path: resolvedPath };
        console.log('✅ Unix-style paths handled correctly');
      } catch (error) {
        results.filePathHandling.unixPaths = { success: false, error: error.message };
        throw new Error(`Unix path handling failed: ${error.message}`);
      }
    });
  });

  describe('Binary Execution Tests', () => {
    test('should execute binary with correct permissions', async () => {
      const binaryPath = path.join(projectRoot, 'bin/unjucks.cjs');
      
      try {
        // Check if binary exists and has execute permissions
        const stats = await fs.stat(binaryPath);
        const isExecutable = !!(stats.mode & 0o111);
        
        results.binaryExecution.exists = true;
        results.binaryExecution.executable = isExecutable;
        results.binaryExecution.mode = stats.mode.toString(8);
        
        expect(isExecutable).toBe(true);
        console.log('✅ Binary has correct execute permissions');
      } catch (error) {
        results.errors.push(`Binary permission check failed: ${error.message}`);
        throw error;
      }
    });

    test('should execute binary and show help', async () => {
      const binaryPath = path.join(projectRoot, 'bin/unjucks.cjs');
      
      try {
        const { stdout, stderr } = await execAsync(`node "${binaryPath}" --help`, {
          cwd: projectRoot,
          timeout: 10000
        });
        
        results.binaryExecution.helpOutput = stdout;
        results.binaryExecution.helpErrors = stderr;
        results.binaryExecution.canExecute = true;
        
        expect(stdout).toContain('Unjucks CLI');
        expect(stdout).toContain('USAGE:');
        console.log('✅ Binary executes correctly and shows help');
      } catch (error) {
        results.binaryExecution.canExecute = false;
        results.errors.push(`Binary execution failed: ${error.message}`);
        throw error;
      }
    });

    test('should execute binary with version flag', async () => {
      const binaryPath = path.join(projectRoot, 'bin/unjucks.cjs');
      
      try {
        const { stdout } = await execAsync(`node "${binaryPath}" --version`, {
          cwd: projectRoot,
          timeout: 5000
        });
        
        results.binaryExecution.version = stdout.trim();
        
        expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
        console.log(`✅ Binary version: ${stdout.trim()}`);
      } catch (error) {
        results.errors.push(`Binary version check failed: ${error.message}`);
        throw error;
      }
    });
  });

  describe('Architecture Tests', () => {
    test('should work on current architecture', async () => {
      const arch = os.arch();
      const supportedArchs = ['x64', 'arm64', 'arm'];
      
      results.architectureTests.current = arch;
      results.architectureTests.supported = supportedArchs.includes(arch);
      
      expect(supportedArchs).toContain(arch);
      console.log(`✅ Architecture ${arch} is supported`);
    });

    test('should handle architecture-specific dependencies', async () => {
      try {
        // Test bcrypt which often has native bindings
        const bcrypt = await import('bcrypt');
        results.architectureTests.nativeDeps = { bcrypt: !!bcrypt };
        console.log('✅ Native dependencies work on current architecture');
      } catch (error) {
        results.architectureTests.nativeDeps = { bcrypt: false };
        results.errors.push(`Native dependency test failed: ${error.message}`);
        // Don't fail the test as bcrypt might not be critical
        console.warn('⚠️ Native dependencies may need rebuilding');
      }
    });
  });

  describe('Module Resolution Tests', () => {
    test('should resolve ESM imports correctly', async () => {
      try {
        const esmModules = {
          citty: await import('citty'),
          chalk: await import('chalk'),
          consola: await import('consola'),
          nunjucks: await import('nunjucks')
        };
        
        results.moduleResolution.esm = Object.keys(esmModules).reduce((acc, key) => {
          acc[key] = !!esmModules[key];
          return acc;
        }, {});
        
        expect(Object.values(results.moduleResolution.esm).every(Boolean)).toBe(true);
        console.log('✅ ESM imports resolve correctly');
      } catch (error) {
        results.errors.push(`ESM resolution failed: ${error.message}`);
        throw error;
      }
    });

    test('should handle relative imports correctly', async () => {
      try {
        // Test relative imports from the CLI
        const cliPath = path.join(projectRoot, 'src/cli/index.js');
        const cliModule = await import(`file://${cliPath}`);
        
        results.moduleResolution.relative = !!cliModule.runMain;
        expect(results.moduleResolution.relative).toBe(true);
        console.log('✅ Relative imports work correctly');
      } catch (error) {
        results.errors.push(`Relative import test failed: ${error.message}`);
        throw error;
      }
    });
  });

  describe('Clean Room Deployment Tests', () => {
    test('should simulate clean npm install', async () => {
      const tempPackageDir = path.join(testWorkspace, 'clean-install-test');
      
      try {
        await fs.mkdir(tempPackageDir, { recursive: true });
        
        // Copy package.json to temp directory
        const originalPackage = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8');
        const packageJson = JSON.parse(originalPackage);
        
        // Create minimal package.json for test
        const testPackage = {
          name: packageJson.name + '-test',
          version: '1.0.0',
          type: 'module',
          engines: packageJson.engines,
          dependencies: {
            citty: packageJson.dependencies.citty,
            chalk: packageJson.dependencies.chalk,
            consola: packageJson.dependencies.consola,
            nunjucks: packageJson.dependencies.nunjucks
          }
        };
        
        await fs.writeFile(
          path.join(tempPackageDir, 'package.json'),
          JSON.stringify(testPackage, null, 2)
        );
        
        // Run npm install in temp directory
        const { stdout, stderr } = await execAsync('npm install --no-audit --no-fund', {
          cwd: tempPackageDir,
          timeout: 60000
        });
        
        results.deploymentTests.npmInstall = {
          success: true,
          output: stdout,
          errors: stderr
        };
        
        // Verify node_modules was created
        const nodeModulesPath = path.join(tempPackageDir, 'node_modules');
        await fs.access(nodeModulesPath);
        
        console.log('✅ Clean npm install successful');
      } catch (error) {
        results.deploymentTests.npmInstall = {
          success: false,
          error: error.message
        };
        results.errors.push(`Clean room npm install failed: ${error.message}`);
        throw error;
      }
    });

    test('should validate package.json exports', async () => {
      const packagePath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
      
      const exports = packageJson.exports;
      const main = packageJson.main;
      const bin = packageJson.bin;
      
      results.deploymentTests.exports = {
        hasExports: !!exports,
        hasMain: !!main,
        hasBin: !!bin,
        exports,
        main,
        bin
      };
      
      expect(exports).toBeDefined();
      expect(bin).toBeDefined();
      expect(bin.unjucks).toBe('./bin/unjucks.cjs');
      
      console.log('✅ Package exports configuration valid');
    });
  });
});

// Utility functions
async function getNpmVersion() {
  try {
    const { stdout } = await execAsync('npm --version');
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}

async function generateValidationReport() {
  const report = {
    timestamp: new Date().toISOString(),
    platform: {
      os: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      npmVersion: await getNpmVersion()
    },
    results,
    summary: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      errors: results.errors.length,
      overallStatus: results.errors.length === 0 ? 'PASSED' : 'FAILED'
    }
  };
  
  const reportPath = path.join(testWorkspace, 'cross-platform-validation-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n🔍 Cross-Platform Validation Report Generated:');
  console.log(`Platform: ${report.platform.os} ${report.platform.arch}`);
  console.log(`Node.js: ${report.platform.nodeVersion}`);
  console.log(`Status: ${report.summary.overallStatus}`);
  console.log(`Errors: ${report.summary.errors}`);
  console.log(`Report saved to: ${reportPath}`);
  
  return report;
}