/**
 * Test Utilities and Helpers
 * Shared utilities for comprehensive testing
 */

import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const cliPath = path.join(projectRoot, 'bin/unjucks.cjs');

/**
 * CLI Execution Helper
 */
export class CLIHelper {
  static async exec(args = [], options = {}) {
    const defaultOptions = {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' },
      timeout: 30000,
      ...options
    };

    return new Promise((resolve) => {
      const child = spawn('node', [cliPath, ...args], defaultOptions);

      let stdout = '';
      let stderr = '';
      const start = performance.now();

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        const duration = performance.now() - start;
        resolve({
          exitCode: exitCode || 0,
          stdout,
          stderr,
          duration,
          success: exitCode === 0
        });
      });

      child.on('error', (error) => {
        const duration = performance.now() - start;
        resolve({
          exitCode: 1,
          stdout,
          stderr: error.message,
          duration,
          success: false,
          error
        });
      });
    });
  }

  static async execMultiple(commands, options = {}) {
    const results = await Promise.all(
      commands.map(cmd => this.exec(cmd, options))
    );
    return results;
  }

  static async execSequential(commands, options = {}) {
    const results = [];
    for (const cmd of commands) {
      const result = await this.exec(cmd, options);
      results.push(result);
    }
    return results;
  }
}

/**
 * File System Test Helper
 */
export class FileSystemHelper {
  static async createTempDir(prefix = 'unjucks-test-') {
    return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  }

  static async cleanupTempDir(tempDir) {
    if (tempDir && tempDir.includes('unjucks-test')) {
      await fs.remove(tempDir);
    }
  }

  static async createTemplateStructure(baseDir, templates) {
    for (const [templatePath, content] of Object.entries(templates)) {
      const fullPath = path.join(baseDir, '_templates', templatePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content);
    }
  }

  static async createTestProject(tempDir, structure = {}) {
    const defaultStructure = {
      '_templates/component/new/component.js.njk': `export class {{ name }} {
  constructor() {
    this.name = '{{ name }}';
  }
}`,
      '_templates/service/api/service.js.njk': `export class {{ name }}Service {
  async start() {
    console.log('{{ name }} service started');
  }
}`,
      'package.json': JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        type: 'module'
      }, null, 2)
    };

    const finalStructure = { ...defaultStructure, ...structure };

    for (const [filePath, content] of Object.entries(finalStructure)) {
      const fullPath = path.join(tempDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content);
    }
  }

  static async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  static async fileExists(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }
}

/**
 * Template Test Helper
 */
export class TemplateHelper {
  static createSimpleTemplate(name, content) {
    return {
      [`${name}/new/file.js.njk`]: content || `// {{ name }} Component
export const {{ name }} = {
  name: '{{ name }}',
  created: this.getDeterministicDate()
};`
    };
  }

  static createComplexTemplate(name) {
    return {
      [`${name}/new/index.js.njk`]: `export { {{ name }} } from './{{ name | lower }}.js';`,
      [`${name}/new/component.js.njk`]: `---
to: {{ name | lower }}.js
---
export class {{ name }} {
  constructor(props = {}) {
    this.props = props;
    this.name = '{{ name }}';
  }

  render() {
    return \`<div class="{{ name | lower }}">\${this.props.children || ''}</div>\`;
  }
}`,
      [`${name}/new/test.js.njk`]: `---
to: __tests__/{{ name | lower }}.test.js
---
import { {{ name }} } from '../{{ name | lower }}.js';

describe('{{ name }}', () => {
  it('should create instance', () => {
    const instance = new {{ name }}();
    expect(instance.name).toBe('{{ name }}');
  });
});`
    };
  }

  static createFrontmatterTemplate(name, frontmatter, content) {
    return {
      [`${name}/new/file.njk`]: `---
${frontmatter}
---
${content}`
    };
  }
}

/**
 * Performance Test Helper
 */
export class PerformanceHelper {
  static async measureOperation(operation, iterations = 1) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await operation();
      const duration = performance.now() - start;
      times.push(duration);
    }

    return {
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((a, b) => a + b) / times.length,
      median: times.sort((a, b) => a - b)[Math.floor(times.length / 2)],
      times
    };
  }

  static async measureMemoryUsage(operation) {
    const initialMemory = process.memoryUsage();
    await operation();
    global.gc && global.gc();
    const finalMemory = process.memoryUsage();

    return {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      external: finalMemory.external - initialMemory.external,
      rss: finalMemory.rss - initialMemory.rss,
      initial: initialMemory,
      final: finalMemory
    };
  }
}

/**
 * Data Generator Helper
 */
export class DataGenerator {
  static randomString(length = 10, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  static randomSafeString(length = 10) {
    return this.randomString(length, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-');
  }

  static randomNumber(min = 0, max = 100) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static randomArray(length = 5, generator = () => this.randomString()) {
    return Array.from({ length }, generator);
  }

  static randomObject(keys = ['name', 'value', 'type']) {
    return keys.reduce((obj, key) => {
      obj[key] = this.randomString();
      return obj;
    }, {});
  }

  static createTestData(type, count = 10) {
    switch (type) {
      case 'users':
        return Array.from({ length: count }, (_, i) => ({
          id: i + 1,
          name: `User${i + 1}`,
          email: `user${i + 1}@example.com`,
          active: Math.random() > 0.5
        }));
      
      case 'components':
        return Array.from({ length: count }, (_, i) => ({
          name: `Component${i + 1}`,
          type: ['button', 'input', 'modal'][i % 3],
          props: this.randomObject(['className', 'disabled', 'onClick'])
        }));
      
      default:
        return Array.from({ length: count }, () => this.randomObject());
    }
  }
}

/**
 * Assertion Helper
 */
export class AssertionHelper {
  static expectSuccessfulCLI(result) {
    expect(result.exitCode).toBe(0);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  }

  static expectFailedCLI(result, expectedErrorPattern) {
    expect(result.exitCode).not.toBe(0);
    expect(result.success).toBe(false);
    if (expectedErrorPattern) {
      expect(result.stderr).toMatch(expectedErrorPattern);
    }
  }

  static expectValidJSON(jsonString) {
    expect(() => JSON.parse(jsonString)).not.toThrow();
    return JSON.parse(jsonString);
  }

  static expectPerformanceWithin(duration, maxMs) {
    expect(duration).toBeLessThan(maxMs);
    expect(duration).toBeGreaterThan(0);
  }

  static expectMemoryUsageWithin(memoryUsage, maxMB) {
    const usageMB = memoryUsage.heapUsed / (1024 * 1024);
    expect(usageMB).toBeLessThan(maxMB);
  }
}

/**
 * Mock Helper
 */
export class MockHelper {
  static createMockFileSystem() {
    return {
      files: new Map(),
      
      async writeFile(filePath, content) {
        this.files.set(filePath, content);
      },
      
      async readFile(filePath) {
        if (!this.files.has(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        return this.files.get(filePath);
      },
      
      async exists(filePath) {
        return this.files.has(filePath);
      },
      
      async list() {
        return Array.from(this.files.keys());
      },
      
      clear() {
        this.files.clear();
      }
    };
  }

  static createMockCLI() {
    return {
      commands: new Map(),
      results: new Map(),
      
      addCommand(name, handler) {
        this.commands.set(name, handler);
      },
      
      async exec(args) {
        const command = args[0];
        if (!this.commands.has(command)) {
          return { exitCode: 1, stderr: `Unknown command: ${command}` };
        }
        
        const handler = this.commands.get(command);
        return await handler(args.slice(1));
      },
      
      setResult(command, result) {
        this.results.set(command, result);
      }
    };
  }
}

/**
 * Environment Helper
 */
export class EnvironmentHelper {
  static async withTempDir(callback) {
    const tempDir = await FileSystemHelper.createTempDir();
    const originalCwd = process.cwd();
    
    try {
      process.chdir(tempDir);
      return await callback(tempDir);
    } finally {
      process.chdir(originalCwd);
      await FileSystemHelper.cleanupTempDir(tempDir);
    }
  }

  static withEnvironment(envVars, callback) {
    const originalEnv = { ...process.env };
    
    try {
      Object.assign(process.env, envVars);
      return callback();
    } finally {
      process.env = originalEnv;
    }
  }

  static async withTimeout(ms, operation) {
    return Promise.race([
      operation(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
      )
    ]);
  }
}

/**
 * Test Suite Builder
 */
export class TestSuiteBuilder {
  constructor(name) {
    this.suiteName = name;
    this.beforeEachHooks = [];
    this.afterEachHooks = [];
    this.tests = [];
  }

  beforeEach(hook) {
    this.beforeEachHooks.push(hook);
    return this;
  }

  afterEach(hook) {
    this.afterEachHooks.push(hook);
    return this;
  }

  addTest(name, testFn, options = {}) {
    this.tests.push({ name, testFn, options });
    return this;
  }

  build() {
    return {
      name: this.suiteName,
      beforeEachHooks: this.beforeEachHooks,
      afterEachHooks: this.afterEachHooks,
      tests: this.tests
    };
  }
}