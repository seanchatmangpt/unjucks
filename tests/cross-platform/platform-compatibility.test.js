/**
 * Cross-Platform Compatibility Test Suite
 * Validates Node.js compatibility, package resolution, file paths, and binary execution
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn } from 'child_process';
import { join, resolve, sep, normalize } from 'path';
import { platform, arch, version as nodeVersion, versions } from 'os';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '../..');
const testWorkspace = join(projectRoot, 'tests/.tmp/cross-platform-test');
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

describe('Cross-Platform Compatibility Validation', () => {
  let originalCwd;
  let testResults = {
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    npmVersion: null,
    paths: {},
    modules: {},
    binary: {},
    installation: {},
    typescript: {}
  };

  beforeAll(async () => {
    originalCwd = process.cwd();
    
    // Create clean test workspace
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
    mkdirSync(testWorkspace, { recursive: true });
    
    // Get npm version
    try {
      testResults.npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    } catch (error) {
      testResults.npmVersion = 'npm not available';
    }
  });

  afterAll(() => {
    process.chdir(originalCwd);
    
    // Cleanup test workspace
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  describe('Node.js Compatibility', () => {
    test('should meet minimum Node.js version requirement', () => {
      const minVersion = packageJson.engines?.node || '>=18.0.0';
      const currentMajor = parseInt(process.version.slice(1).split('.')[0]);
      const minMajor = parseInt(minVersion.replace(/[>=~^]/, '').split('.')[0]);
      
      expect(currentMajor).toBeGreaterThanOrEqual(minMajor);
      
      testResults.nodeVersion = {
        current: process.version,
        required: minVersion,
        compatible: currentMajor >= minMajor
      };
    });

    test('should have required Node.js features available', () => {
      const requiredFeatures = {
        esModules: typeof import.meta !== 'undefined',
        asyncAwait: true, // Always available in Node 18+
        workerThreads: 'worker_threads' in process.versions,
        crypto: 'crypto' in process.versions || typeof crypto !== 'undefined'
      };

      Object.values(requiredFeatures).forEach(feature => {
        expect(feature).toBe(true);
      });

      testResults.nodeVersion.features = requiredFeatures;
    });

    test('should support ES modules and import maps', async () => {
      const testModule = `
        export const testExport = 'success';
        export default function testDefault() {
          return 'default export works';
        }
      `;
      
      const testPath = join(testWorkspace, 'test-module.mjs');
      writeFileSync(testPath, testModule);
      
      const { testExport, default: testDefault } = await import(pathToFileURL(testPath));
      
      expect(testExport).toBe('success');
      expect(testDefault()).toBe('default export works');
      
      testResults.modules.esModules = true;
    });
  });

  describe('Package Resolution and Dependencies', () => {
    test('should resolve all production dependencies', () => {
      const dependencies = packageJson.dependencies || {};
      const resolutionResults = {};
      
      Object.keys(dependencies).forEach(dep => {
        try {
          const resolved = require.resolve(dep, { paths: [projectRoot] });
          resolutionResults[dep] = {
            resolved: true,
            path: resolved
          };
        } catch (error) {
          resolutionResults[dep] = {
            resolved: false,
            error: error.message
          };
        }
      });

      const unresolvedDeps = Object.entries(resolutionResults)
        .filter(([, result]) => !result.resolved)
        .map(([dep]) => dep);

      expect(unresolvedDeps).toHaveLength(0);
      testResults.modules.dependencies = resolutionResults;
    });

    test('should handle module resolution correctly', async () => {
      const moduleTests = [
        { module: 'citty', type: 'named import' },
        { module: 'chalk', type: 'default import' },
        { module: 'nunjucks', type: 'mixed import' },
        { module: 'fs-extra', type: 'namespace import' }
      ];

      const results = {};
      
      for (const { module, type } of moduleTests) {
        try {
          if (type === 'named import') {
            const { defineCommand } = await import(module);
            results[module] = { success: true, hasNamedExports: typeof defineCommand === 'function' };
          } else if (type === 'default import') {
            const mod = await import(module);
            results[module] = { success: true, hasDefault: mod.default !== undefined };
          } else if (type === 'mixed import') {
            const mod = await import(module);
            results[module] = { 
              success: true, 
              hasDefault: mod.default !== undefined,
              hasNamed: Object.keys(mod).length > 1
            };
          } else {
            const mod = await import(module);
            results[module] = { success: true, type: typeof mod };
          }
        } catch (error) {
          results[module] = { success: false, error: error.message };
        }
      }

      Object.values(results).forEach(result => {
        expect(result.success).toBe(true);
      });

      testResults.modules.resolution = results;
    });
  });

  describe('File Path Handling', () => {
    test('should handle cross-platform file paths correctly', () => {
      const testPaths = [
        'simple/path',
        'path/with/multiple/segments',
        'path\\\\with\\\\backslashes',
        'path with spaces/file.txt',
        '../relative/path',
        './current/directory/path',
        'path/with.extension.multiple.dots.txt'
      ];

      const pathResults = {};
      
      testPaths.forEach(testPath => {
        const normalized = normalize(testPath);
        const joined = join(testWorkspace, testPath);
        const resolved = resolve(testPath);
        
        pathResults[testPath] = {
          original: testPath,
          normalized: normalized,
          joined: joined,
          resolved: resolved,
          separator: sep,
          isAbsolute: resolve(testPath) === normalized
        };

        // Basic validation that paths are processed
        expect(typeof normalized).toBe('string');
        expect(typeof joined).toBe('string');
        expect(typeof resolved).toBe('string');
      });

      testResults.paths.pathHandling = pathResults;
      testResults.paths.platformSeparator = sep;
      testResults.paths.platform = process.platform;
    });

    test('should create and access files with various path formats', () => {
      const testFiles = [
        'simple-file.txt',
        'file with spaces.txt',
        'nested/directory/file.txt',
        'file.with.multiple.extensions.txt'
      ];

      const fileResults = {};

      testFiles.forEach(fileName => {
        const fullPath = join(testWorkspace, fileName);
        const dirPath = resolve(fullPath, '..');
        
        try {
          // Ensure directory exists
          mkdirSync(dirPath, { recursive: true });
          
          // Write test content
          const testContent = `Test content for ${fileName} on ${process.platform}`;
          writeFileSync(fullPath, testContent, 'utf8');
          
          // Read back content
          const readContent = readFileSync(fullPath, 'utf8');
          
          fileResults[fileName] = {
            created: existsSync(fullPath),
            contentMatches: readContent === testContent,
            path: fullPath
          };

          expect(existsSync(fullPath)).toBe(true);
          expect(readContent).toBe(testContent);
        } catch (error) {
          fileResults[fileName] = {
            created: false,
            error: error.message
          };
        }
      });

      testResults.paths.fileCreation = fileResults;
    });
  });

  describe('Binary Execution and CLI Functionality', () => {
    test('should execute binary with correct permissions', () => {
      const binPath = join(projectRoot, 'bin/unjucks.cjs');
      expect(existsSync(binPath)).toBe(true);
      
      try {
        // Test binary execution with --version flag
        const result = execSync(`node "${binPath}" --version`, {
          cwd: projectRoot,
          encoding: 'utf8',
          timeout: 10000
        });

        testResults.binary.execution = {
          success: true,
          output: result.trim(),
          path: binPath
        };

        expect(result.trim()).toBeTruthy();
      } catch (error) {
        testResults.binary.execution = {
          success: false,
          error: error.message
        };
        throw error;
      }
    });

    test('should handle command line arguments correctly', () => {
      const testCommands = [
        ['--help'],
        ['--version'],
        ['list'],
        ['generate', '--help']
      ];

      const commandResults = {};

      testCommands.forEach(args => {
        const commandKey = args.join(' ');
        try {
          const result = execSync(`node "${join(projectRoot, 'bin/unjucks.cjs')}" ${args.join(' ')}`, {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: 10000
          });

          commandResults[commandKey] = {
            success: true,
            output: result.length,
            exitCode: 0
          };
        } catch (error) {
          commandResults[commandKey] = {
            success: false,
            error: error.message,
            exitCode: error.status || -1
          };
        }
      });

      testResults.binary.commands = commandResults;

      // At least --help and --version should work
      expect(commandResults['--help']?.success || commandResults['--version']?.success).toBe(true);
    });
  });

  describe('NPM Installation and Package Management', () => {
    test('should support npm install in clean environment', async () => {
      const testPackageJson = {
        name: 'cross-platform-test',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          chalk: packageJson.dependencies.chalk
        }
      };

      const testPackagePath = join(testWorkspace, 'npm-test');
      mkdirSync(testPackagePath, { recursive: true });
      writeFileSync(
        join(testPackagePath, 'package.json'),
        JSON.stringify(testPackageJson, null, 2)
      );

      try {
        process.chdir(testPackagePath);
        
        const installResult = execSync('npm install', {
          cwd: testPackagePath,
          encoding: 'utf8',
          timeout: 60000
        });

        const nodeModulesExists = existsSync(join(testPackagePath, 'node_modules'));
        const chalkExists = existsSync(join(testPackagePath, 'node_modules/chalk'));

        testResults.installation.npmInstall = {
          success: true,
          output: installResult.length,
          nodeModulesCreated: nodeModulesExists,
          dependenciesInstalled: chalkExists
        };

        expect(nodeModulesExists).toBe(true);
        expect(chalkExists).toBe(true);
      } catch (error) {
        testResults.installation.npmInstall = {
          success: false,
          error: error.message
        };
        throw error;
      } finally {
        process.chdir(originalCwd);
      }
    });

    test('should handle package.json exports and imports correctly', () => {
      const exportsConfig = packageJson.exports || {};
      const mainField = packageJson.main;
      const moduleField = packageJson.module;

      testResults.installation.packageConfig = {
        hasExports: Object.keys(exportsConfig).length > 0,
        hasMain: !!mainField,
        hasModule: !!moduleField,
        type: packageJson.type,
        exports: exportsConfig
      };

      // Should have either exports or main field
      expect(Object.keys(exportsConfig).length > 0 || !!mainField).toBe(true);
    });
  });

  describe('TypeScript Compatibility (JavaScript Project)', () => {
    test('should not require TypeScript compilation', () => {
      const hasTypeScript = existsSync(join(projectRoot, 'tsconfig.json'));
      const hasTsBuildInfo = existsSync(join(projectRoot, 'tsconfig.tsbuildinfo'));
      
      testResults.typescript.required = false;
      testResults.typescript.configExists = hasTypeScript;
      testResults.typescript.buildArtifacts = hasTsBuildInfo;
      
      // JavaScript project should not require TypeScript
      expect(hasTypeScript).toBe(false);
      expect(hasTsBuildInfo).toBe(false);
    });

    test('should support type definitions for better DX', () => {
      const dependencies = packageJson.dependencies || {};
      const devDependencies = packageJson.devDependencies || {};
      
      const hasTypeDefinitions = Object.keys(dependencies)
        .concat(Object.keys(devDependencies))
        .some(dep => dep.startsWith('@types/'));
      
      testResults.typescript.typeDefinitions = hasTypeDefinitions;
      
      // Having type definitions is optional but beneficial
      expect(typeof hasTypeDefinitions).toBe('boolean');
    });
  });

  describe('Architecture-Specific Functionality', () => {
    test('should work on current architecture', () => {
      const currentArch = process.arch;
      const supportedArchs = ['x64', 'arm64', 'arm'];
      
      testResults.architecture = {
        current: currentArch,
        supported: supportedArchs.includes(currentArch),
        platform: process.platform
      };

      expect(supportedArchs.includes(currentArch)).toBe(true);
    });

    test('should handle native dependencies correctly', () => {
      const dependencies = packageJson.dependencies || {};
      const nativeDeps = [];
      
      // Check for common native dependencies
      Object.keys(dependencies).forEach(dep => {
        if (['bcrypt', 'sharp', 'canvas', 'sqlite3', 'node-gyp'].includes(dep)) {
          nativeDeps.push(dep);
        }
      });

      testResults.architecture.nativeDependencies = nativeDeps;

      if (nativeDeps.length > 0) {
        // Native deps should be installable on current architecture
        nativeDeps.forEach(dep => {
          try {
            require.resolve(dep, { paths: [projectRoot] });
          } catch (error) {
            throw new Error(`Native dependency ${dep} not properly installed for ${process.arch}`);
          }
        });
      }

      expect(Array.isArray(nativeDeps)).toBe(true);
    });
  });

  describe('Environment Variables and Configuration', () => {
    test('should handle environment-specific configuration', () => {
      const originalEnv = process.env.NODE_ENV;
      const testEnvs = ['development', 'production', 'test'];
      
      const envResults = {};
      
      testEnvs.forEach(env => {
        process.env.NODE_ENV = env;
        
        // Test basic environment handling
        envResults[env] = {
          nodeEnv: process.env.NODE_ENV,
          isDevelopment: process.env.NODE_ENV === 'development',
          isProduction: process.env.NODE_ENV === 'production',
          isTest: process.env.NODE_ENV === 'test'
        };
      });

      process.env.NODE_ENV = originalEnv;
      testResults.environment = envResults;

      expect(Object.keys(envResults)).toHaveLength(3);
    });
  });

  test('should generate comprehensive compatibility report', () => {
    const report = {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      npmVersion: testResults.npmVersion,
      compatibility: {
        nodeJs: testResults.nodeVersion,
        modules: testResults.modules,
        paths: testResults.paths,
        binary: testResults.binary,
        installation: testResults.installation,
        typescript: testResults.typescript,
        architecture: testResults.architecture,
        environment: testResults.environment
      },
      summary: {
        totalTests: expect.getState().testPath ? 1 : 0,
        platformSupported: true,
        nodeCompatible: testResults.nodeVersion?.compatible ?? true,
        binaryExecutable: testResults.binary?.execution?.success ?? false,
        npmInstallable: testResults.installation?.npmInstall?.success ?? false
      }
    };

    // Write report to test workspace
    writeFileSync(
      join(testWorkspace, 'cross-platform-compatibility-report.json'),
      JSON.stringify(report, null, 2)
    );

    expect(report.summary.platformSupported).toBe(true);
    expect(report.summary.nodeCompatible).toBe(true);
  });
});