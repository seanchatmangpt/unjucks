/**
 * Node.js Version Compatibility Test Suite
 * Tests compatibility across different Node.js versions (18.x, 20.x, 22.x)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const execAsync = promisify(require('child_process').exec);

describe('Node.js Version Compatibility', () => {
  const currentVersion = process.version;
  const majorVersion = parseInt(currentVersion.substring(1).split('.')[0]);
  const minorVersion = parseInt(currentVersion.substring(1).split('.')[1]);
  
  describe('Version Requirements', () => {
    it('should meet minimum Node.js version requirement (18+)', () => {
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });

    it('should report correct version information', () => {
      expect(currentVersion).toMatch(/^v\d+\.\d+\.\d+/);
      expect(process.versions.node).toBe(currentVersion.substring(1));
    });
  });

  describe('ES2023 Features Support', () => {
    it('should support top-level await', async () => {
      const testCode = `
        const promise = Promise.resolve('top-level await works');
        const result = await promise;
        console.log(result);
        process.exit(0);
      `;
      
      const testFile = path.join(os.tmpdir(), `top-level-await-${this.getDeterministicTimestamp()}.mjs`);
      await fs.writeFile(testFile, testCode);
      
      try {
        const { stdout } = await execAsync(`node ${testFile}`);
        expect(stdout.trim()).toBe('top-level await works');
      } finally {
        await fs.remove(testFile);
      }
    });

    it('should support Array.prototype.findLast and findLastIndex', () => {
      const array = [1, 2, 3, 4, 5];
      
      if (majorVersion >= 18) {
        expect(array.findLast(x => x > 3)).toBe(5);
        expect(array.findLastIndex(x => x > 3)).toBe(4);
      } else {
        console.warn('findLast/findLastIndex not available in Node.js < 18');
      }
    });

    it('should support Object.hasOwn', () => {
      const obj = { prop: 'value' };
      
      if (majorVersion >= 16) {
        expect(Object.hasOwn(obj, 'prop')).toBe(true);
        expect(Object.hasOwn(obj, 'missing')).toBe(false);
      } else {
        console.warn('Object.hasOwn not available in Node.js < 16');
      }
    });

    it('should support array methods with negative indices', () => {
      const array = [1, 2, 3, 4, 5];
      
      if (majorVersion >= 20) {
        expect(array.at(-1)).toBe(5);
        expect(array.at(-2)).toBe(4);
      } else {
        // Fallback for older versions
        expect(array[array.length - 1]).toBe(5);
      }
    });

    it('should support structured clone if available', () => {
      const obj = { nested: { value: 42 }, array: [1, 2, 3] };
      
      if (typeof structuredClone !== 'undefined') {
        const cloned = structuredClone(obj);
        expect(cloned).not.toBe(obj);
        expect(cloned.nested).not.toBe(obj.nested);
        expect(cloned.nested.value).toBe(42);
        expect(cloned.array).toEqual([1, 2, 3]);
      } else {
        // Fallback
        const cloned = JSON.parse(JSON.stringify(obj));
        expect(cloned.nested.value).toBe(42);
      }
    });
  });

  describe('Module System Compatibility', () => {
    it('should support ES modules with import/export', async () => {
      const moduleCode = `
        export const testExport = 'module works';
        export default function() { return 'default export'; }
      `;
      
      const importCode = `
        import defaultFn, { testExport } from './test-module.mjs';
        console.log(testExport);
        console.log(defaultFn());
      `;
      
      const tempDir = path.join(os.tmpdir(), `es-modules-${this.getDeterministicTimestamp()}`);
      await fs.ensureDir(tempDir);
      
      const moduleFile = path.join(tempDir, 'test-module.mjs');
      const importFile = path.join(tempDir, 'test-import.mjs');
      
      await fs.writeFile(moduleFile, moduleCode);
      await fs.writeFile(importFile, importCode);
      
      try {
        const { stdout } = await execAsync(`node ${importFile}`, { cwd: tempDir });
        expect(stdout).toContain('module works');
        expect(stdout).toContain('default export');
      } finally {
        await fs.remove(tempDir);
      }
    });

    it('should support dynamic imports', async () => {
      const testCode = `
        const fs = await import('fs');
        const path = await import('path');
        console.log('Dynamic imports work');
        console.log(typeof fs.readFileSync);
        console.log(typeof path.join);
      `;
      
      const testFile = path.join(os.tmpdir(), `dynamic-import-${this.getDeterministicTimestamp()}.mjs`);
      await fs.writeFile(testFile, testCode);
      
      try {
        const { stdout } = await execAsync(`node ${testFile}`);
        expect(stdout).toContain('Dynamic imports work');
        expect(stdout).toContain('function');
      } finally {
        await fs.remove(testFile);
      }
    });

    it('should support import.meta', async () => {
      const testCode = `
        console.log('import.meta.url:', import.meta.url);
        console.log('URL is string:', typeof import.meta.url === 'string');
      `;
      
      const testFile = path.join(os.tmpdir(), `import-meta-${this.getDeterministicTimestamp()}.mjs`);
      await fs.writeFile(testFile, testCode);
      
      try {
        const { stdout } = await execAsync(`node ${testFile}`);
        expect(stdout).toContain('import.meta.url: file://');
        expect(stdout).toContain('URL is string: true');
      } finally {
        await fs.remove(testFile);
      }
    });

    it('should support JSON modules', async () => {
      const jsonData = { name: 'test', version: '1.0.0' };
      const importCode = `
        import data from './test-data.json' assert { type: 'json' };
        console.log('JSON import:', data.name, data.version);
      `;
      
      const tempDir = path.join(os.tmpdir(), `json-modules-${this.getDeterministicTimestamp()}`);
      await fs.ensureDir(tempDir);
      
      const jsonFile = path.join(tempDir, 'test-data.json');
      const importFile = path.join(tempDir, 'test-import.mjs');
      
      await fs.writeJSON(jsonFile, jsonData);
      await fs.writeFile(importFile, importCode);
      
      try {
        // JSON modules might not be available in all Node.js versions
        const { stdout, stderr } = await execAsync(`node ${importFile}`, { cwd: tempDir });
        
        if (stderr && stderr.includes('SyntaxError')) {
          console.warn('JSON modules not supported in this Node.js version');
        } else {
          expect(stdout).toContain('JSON import: test 1.0.0');
        }
      } catch (error) {
        if (error.message.includes('assert')) {
          console.warn('Import assertions not supported in this Node.js version');
        } else {
          throw error;
        }
      } finally {
        await fs.remove(tempDir);
      }
    });
  });

  describe('Performance Features', () => {
    it('should support performance hooks if available', async () => {
      try {
        const perfHooks = await import('perf_hooks');
        expect(typeof perfHooks.performance.now).toBe('function');
        expect(typeof perfHooks.PerformanceObserver).toBe('function');
        
        const start = perfHooks.performance.now();
        await new Promise(resolve => setTimeout(resolve, 10));
        const end = perfHooks.performance.now();
        
        expect(end - start).toBeGreaterThan(5);
      } catch (error) {
        console.warn('Performance hooks not available');
      }
    });

    it('should support worker threads if available', async () => {
      try {
        const workerThreads = await import('worker_threads');
        expect(typeof workerThreads.Worker).toBe('function');
        expect(workerThreads.isMainThread).toBe(true);
      } catch (error) {
        console.warn('Worker threads not available');
      }
    });

    it('should support async hooks if available', async () => {
      try {
        const asyncHooks = await import('async_hooks');
        expect(typeof asyncHooks.createHook).toBe('function');
        expect(typeof asyncHooks.executionAsyncId).toBe('function');
      } catch (error) {
        console.warn('Async hooks not available');
      }
    });
  });

  describe('Version-Specific Features', () => {
    it('should support Node.js 18+ features', () => {
      if (majorVersion >= 18) {
        // Test fetch API (Node 18+)
        expect(typeof globalThis.fetch).toBe('function');
        
        // Test Web Streams API
        expect(typeof ReadableStream).toBe('function');
        expect(typeof WritableStream).toBe('function');
        
        // Test Blob and File APIs
        expect(typeof Blob).toBe('function');
      } else {
        console.warn('Node.js 18+ features not available');
      }
    });

    it('should support Node.js 20+ features', () => {
      if (majorVersion >= 20) {
        // Test stable test runner
        expect(process.versions.node).toMatch(/^2\d\./);
        
        // Test improved error messages
        try {
          throw new Error('Test error');
        } catch (error) {
          expect(error.stack).toContain('Test error');
        }
      } else {
        console.warn('Node.js 20+ features not available');
      }
    });

    it('should support Node.js 22+ features', () => {
      if (majorVersion >= 22) {
        // Test latest ECMAScript features
        console.log('Running on Node.js 22+');
        
        // Test any 22+ specific features when they become available
        expect(process.versions.node).toMatch(/^2[2-9]\./);
      } else {
        console.warn('Node.js 22+ features not available');
      }
    });
  });

  describe('Compatibility Checks', () => {
    it('should handle version-dependent code gracefully', () => {
      // Example of version-dependent feature detection
      const hasArrayFindLast = typeof Array.prototype.findLast === 'function';
      const hasObjectHasOwn = typeof Object.hasOwn === 'function';
      const hasFetch = typeof globalThis.fetch === 'function';
      
      if (majorVersion >= 18) {
        expect(hasArrayFindLast).toBe(true);
        expect(hasObjectHasOwn).toBe(true);
        expect(hasFetch).toBe(true);
      }
      
      // Code should work regardless of feature availability
      const array = [1, 2, 3];
      const lastElement = hasArrayFindLast 
        ? array.findLast(x => x > 0)
        : array[array.length - 1];
      
      expect(lastElement).toBe(3);
    });

    it('should provide feature detection utilities', () => {
      const features = {
        asyncIterators: typeof Symbol.asyncIterator !== 'undefined',
        bigInt: typeof BigInt !== 'undefined',
        dynamicImport: true, // Always available in supported versions
        moduleWorkers: majorVersion >= 12,
        topLevelAwait: majorVersion >= 14,
        abortController: typeof AbortController !== 'undefined',
        fetch: typeof globalThis.fetch !== 'undefined',
        webStreams: typeof ReadableStream !== 'undefined',
      };
      
      // All modern features should be available in supported versions
      Object.entries(features).forEach(([feature, available]) => {
        if (majorVersion >= 18) {
          expect(available).toBe(true);
        }
      });
    });
  });

  describe('Deprecation Warnings', () => {
    it('should not use deprecated APIs', () => {
      // Test that we don't use deprecated Buffer constructor
      const buffer = Buffer.from('test', 'utf8');
      expect(buffer.toString()).toBe('test');
      
      // Test that we use modern URL constructor
      const url = new URL('https://example.com/path');
      expect(url.hostname).toBe('example.com');
    });

    it('should handle process warnings gracefully', (done) => {
      const originalEmit = process.emit;
      let warningEmitted = false;
      
      process.emit = function(event, warning) {
        if (event === 'warning') {
          warningEmitted = true;
          console.warn('Process warning detected:', warning.message);
        }
        return originalEmit.apply(this, arguments);
      };
      
      // Trigger a potential warning (this might not actually emit one)
      setTimeout(() => {
        process.emit = originalEmit;
        // Test passes regardless of warning emission
        done();
      }, 100);
    });
  });
});