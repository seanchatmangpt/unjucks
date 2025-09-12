/**
 * Cross-Platform Compatibility Test Suite
 * Tests operating system, Node.js version, and package manager compatibility
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

describe('Cross-Platform Compatibility', () => {
  let testDir;
  let originalCwd;
  const platform = os.platform();
  const architecture = os.arch();
  const nodeVersion = process.version;

  beforeAll(async () => {
    originalCwd = process.cwd();
    testDir = path.join(os.tmpdir(), `unjucks-compat-test-${this.getDeterministicTimestamp()}`);
    await fs.ensureDir(testDir);
    process.chdir(testDir);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    await fs.remove(testDir);
  });

  describe('Operating System Compatibility', () => {
    it('should detect current platform correctly', () => {
      expect(platform).toMatch(/^(darwin|linux|win32)$/);
      expect(architecture).toMatch(/^(x64|arm64|arm|ia32)$/);
    });

    it('should handle platform-specific path separators', () => {
      const testPath = path.join('src', 'components', 'test.js');
      const expectedSeparator = platform === 'win32' ? '\\' : '/';
      
      if (platform === 'win32') {
        expect(testPath).toContain('\\');
      } else {
        expect(testPath).toContain('/');
      }
    });

    it('should handle platform-specific line endings', async () => {
      const testContent = 'Line 1\nLine 2\nLine 3';
      const testFile = path.join(testDir, 'line-endings.txt');
      
      await fs.writeFile(testFile, testContent);
      const readContent = await fs.readFile(testFile, 'utf8');
      
      expect(readContent).toContain('Line 1');
      expect(readContent).toContain('Line 2');
      expect(readContent).toContain('Line 3');
    });

    it('should handle platform-specific executable extensions', () => {
      const executableName = platform === 'win32' ? 'unjucks.exe' : 'unjucks';
      const binPath = path.join('node_modules', '.bin', executableName);
      
      // Test that we can construct the correct executable path
      expect(binPath).toBeTruthy();
    });

    it('should handle platform-specific temporary directories', () => {
      const tempDir = os.tmpdir();
      
      if (platform === 'win32') {
        expect(tempDir).toMatch(/[A-Z]:\\/);
      } else {
        expect(tempDir).toMatch(/^\/tmp|^\/var\/folders/);
      }
      
      expect(fs.existsSync(tempDir)).toBe(true);
    });
  });

  describe('Node.js Version Compatibility', () => {
    it('should run on Node.js 18+', () => {
      const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });

    it('should support ES modules', async () => {
      const testFile = path.join(testDir, 'es-module-test.mjs');
      const testContent = `
        import { readFileSync } from 'fs';
        export const testFunction = () => 'ES modules work';
        console.log('ES module loaded successfully');
      `;
      
      await fs.writeFile(testFile, testContent);
      
      try {
        const { stdout, stderr } = await execAsync(`node ${testFile}`);
        expect(stdout).toContain('ES module loaded successfully');
        expect(stderr).toBe('');
      } catch (error) {
        throw new Error(`ES module test failed: ${error.message}`);
      }
    });

    it('should support modern JavaScript features', () => {
      // Test nullish coalescing
      const value = null ?? 'default';
      expect(value).toBe('default');
      
      // Test optional chaining
      const obj = { nested: { prop: 'value' } };
      expect(obj.nested?.prop).toBe('value');
      expect(obj.missing?.prop).toBeUndefined();
      
      // Test BigInt support
      const bigInt = 123n;
      expect(typeof bigInt).toBe('bigint');
      
      // Test async/await
      const asyncTest = async () => 'async works';
      expect(asyncTest()).toBeInstanceOf(Promise);
    });

    it('should handle process.env correctly', () => {
      process.env.UNJUCKS_TEST_VAR = 'test-value';
      expect(process.env.UNJUCKS_TEST_VAR).toBe('test-value');
      delete process.env.UNJUCKS_TEST_VAR;
    });

    it('should support worker threads if available', () => {
      try {
        const { Worker, isMainThread } = require('worker_threads');
        expect(isMainThread).toBe(true);
        expect(typeof Worker).toBe('function');
      } catch (error) {
        // Worker threads might not be available in all environments
        expect(error.code).toBe('MODULE_NOT_FOUND');
      }
    });
  });

  describe('Package Manager Compatibility', () => {
    it('should work with pnpm (primary)', async () => {
      try {
        const { stdout } = await execAsync('pnpm --version');
        expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
      } catch (error) {
        console.warn('pnpm not available for testing');
      }
    });

    it('should work with npm', async () => {
      try {
        const { stdout } = await execAsync('npm --version');
        expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
      } catch (error) {
        throw new Error('npm should be available in all environments');
      }
    });

    it('should work with yarn if available', async () => {
      try {
        const { stdout } = await execAsync('yarn --version');
        expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
      } catch (error) {
        console.warn('yarn not available for testing');
      }
    });

    it('should handle package.json correctly', async () => {
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
        type: 'module',
        engines: {
          node: '>=18.0.0'
        }
      };
      
      const packagePath = path.join(testDir, 'package.json');
      await fs.writeJSON(packagePath, packageJson, { spaces: 2 });
      
      const readPackage = await fs.readJSON(packagePath);
      expect(readPackage.name).toBe('test-package');
      expect(readPackage.type).toBe('module');
    });

    it('should handle lockfile formats', () => {
      const lockFiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
      
      lockFiles.forEach(lockFile => {
        const isValid = lockFile.match(/\.(json|yaml|lock)$/);
        expect(isValid).toBeTruthy();
      });
    });
  });

  describe('File System Compatibility', () => {
    it('should handle Unicode file names', async () => {
      const unicodeFileName = '测试文件-émojis-🚀.txt';
      const filePath = path.join(testDir, unicodeFileName);
      
      await fs.writeFile(filePath, 'Unicode content');
      const exists = await fs.pathExists(filePath);
      expect(exists).toBe(true);
      
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('Unicode content');
    });

    it('should handle long file paths', async () => {
      const longPath = 'very-long-directory-name'.repeat(10);
      const fullPath = path.join(testDir, longPath);
      
      try {
        await fs.ensureDir(fullPath);
        const testFile = path.join(fullPath, 'test.txt');
        await fs.writeFile(testFile, 'content');
        
        const exists = await fs.pathExists(testFile);
        expect(exists).toBe(true);
      } catch (error) {
        // Some filesystems have path length limits
        if (error.code === 'ENAMETOOLONG' || error.code === 'ENOENT') {
          console.warn(`Platform ${platform} has path length restrictions`);
        } else {
          throw error;
        }
      }
    });

    it('should handle case sensitivity correctly', async () => {
      const lowerFile = path.join(testDir, 'testfile.txt');
      const upperFile = path.join(testDir, 'TESTFILE.TXT');
      
      await fs.writeFile(lowerFile, 'lower');
      
      const lowerExists = await fs.pathExists(lowerFile);
      const upperExists = await fs.pathExists(upperFile);
      
      expect(lowerExists).toBe(true);
      
      // macOS and Windows are case-insensitive, Linux is case-sensitive
      if (platform === 'darwin' || platform === 'win32') {
        expect(upperExists).toBe(true);
      } else {
        expect(upperExists).toBe(false);
      }
    });

    it('should handle symlinks if supported', async () => {
      const targetFile = path.join(testDir, 'target.txt');
      const symlinkFile = path.join(testDir, 'symlink.txt');
      
      await fs.writeFile(targetFile, 'target content');
      
      try {
        await fs.symlink(targetFile, symlinkFile);
        const stats = await fs.lstat(symlinkFile);
        expect(stats.isSymbolicLink()).toBe(true);
        
        const content = await fs.readFile(symlinkFile, 'utf8');
        expect(content).toBe('target content');
      } catch (error) {
        if (error.code === 'EPERM' && platform === 'win32') {
          console.warn('Symlinks require admin privileges on Windows');
        } else {
          throw error;
        }
      }
    });
  });

  describe('Memory and Performance', () => {
    it('should operate within reasonable memory limits', () => {
      const memUsage = process.memoryUsage();
      
      // Heap should be less than 100MB for basic operations
      expect(memUsage.heapUsed).toBeLessThan(100 * 1024 * 1024);
      
      // RSS should be reasonable
      expect(memUsage.rss).toBeLessThan(200 * 1024 * 1024);
    });

    it('should handle concurrent operations', async () => {
      const concurrentOps = Array.from({ length: 10 }, async (_, i) => {
        const file = path.join(testDir, `concurrent-${i}.txt`);
        await fs.writeFile(file, `Content ${i}`);
        const content = await fs.readFile(file, 'utf8');
        return content;
      });
      
      const results = await Promise.all(concurrentOps);
      expect(results).toHaveLength(10);
      results.forEach((content, i) => {
        expect(content).toBe(`Content ${i}`);
      });
    });

    it('should handle large files efficiently', async () => {
      const largeContent = 'A'.repeat(1024 * 1024); // 1MB
      const largeFile = path.join(testDir, 'large-file.txt');
      
      const startTime = this.getDeterministicTimestamp();
      await fs.writeFile(largeFile, largeContent);
      const content = await fs.readFile(largeFile, 'utf8');
      const endTime = this.getDeterministicTimestamp();
      
      expect(content.length).toBe(1024 * 1024);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Environment Variables', () => {
    it('should handle environment variable parsing', () => {
      process.env.UNJUCKS_TEST_NUM = '42';
      process.env.UNJUCKS_TEST_BOOL = 'true';
      process.env.UNJUCKS_TEST_JSON = '{"key": "value"}';
      
      expect(parseInt(process.env.UNJUCKS_TEST_NUM)).toBe(42);
      expect(process.env.UNJUCKS_TEST_BOOL === 'true').toBe(true);
      
      const jsonValue = JSON.parse(process.env.UNJUCKS_TEST_JSON);
      expect(jsonValue.key).toBe('value');
      
      // Cleanup
      delete process.env.UNJUCKS_TEST_NUM;
      delete process.env.UNJUCKS_TEST_BOOL;
      delete process.env.UNJUCKS_TEST_JSON;
    });

    it('should handle PATH environment variable', () => {
      const pathVar = process.env.PATH || process.env.Path;
      expect(pathVar).toBeTruthy();
      
      const pathSeparator = platform === 'win32' ? ';' : ':';
      const pathEntries = pathVar.split(pathSeparator);
      expect(pathEntries.length).toBeGreaterThan(0);
    });

    it('should handle HOME/USERPROFILE directory', () => {
      const homeDir = os.homedir();
      expect(homeDir).toBeTruthy();
      expect(fs.existsSync(homeDir)).toBe(true);
    });
  });

  describe('Shell and Process Integration', () => {
    it('should execute shell commands correctly', async () => {
      const command = platform === 'win32' ? 'echo %CD%' : 'pwd';
      
      try {
        const { stdout } = await execAsync(command);
        expect(stdout.trim()).toBeTruthy();
      } catch (error) {
        throw new Error(`Shell command failed: ${error.message}`);
      }
    });

    it('should handle process signals', (done) => {
      const childProcess = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 10000)']);
      
      let signalReceived = false;
      childProcess.on('exit', (code, signal) => {
        expect(signal).toBe('SIGTERM');
        signalReceived = true;
        done();
      });
      
      setTimeout(() => {
        childProcess.kill('SIGTERM');
      }, 100);
      
      setTimeout(() => {
        if (!signalReceived) {
          done(new Error('Signal not received'));
        }
      }, 5000);
    });

    it('should handle stdin/stdout/stderr correctly', async () => {
      const testScript = `
        process.stdout.write('stdout message\\n');
        process.stderr.write('stderr message\\n');
        process.exit(0);
      `;
      
      const child = spawn(process.execPath, ['-e', testScript]);
      
      let stdoutData = '';
      let stderrData = '';
      
      child.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      return new Promise((resolve) => {
        child.on('exit', (code) => {
          expect(code).toBe(0);
          expect(stdoutData).toContain('stdout message');
          expect(stderrData).toContain('stderr message');
          resolve();
        });
      });
    });
  });
});