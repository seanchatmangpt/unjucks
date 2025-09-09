/**
 * Core test helper utilities for Unjucks testing
 * Provides test environment setup, teardown, and CLI testing capabilities
 */

import fs from 'fs-extra';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../');

/**
 * Main test helper class
 */
export class TestHelper {
  constructor() {
    this.tempDir = null;
    this.originalCwd = process.cwd();
    this.cleanup = [];
  }

  /**
   * Create and change to a temporary directory
   */
  async changeToTempDir() {
    this.tempDir = path.join(tmpdir(), 'unjucks-test-' + Date.now() + '-' + Math.random().toString(36).substring(2));
    await fs.ensureDir(this.tempDir);
    process.chdir(this.tempDir);
    return this.tempDir;
  }

  /**
   * Run CLI command and capture output
   */
  async runCli(command, args = [], options = {}) {
    const cliPath = path.join(PROJECT_ROOT, 'bin/unjucks.js');
    
    const fullArgs = [cliPath, command, ...args];
    
    return new Promise((resolve, reject) => {
      const child = spawn('node', fullArgs, {
        cwd: PROJECT_ROOT, // Always run from project root to access dependencies
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          ...options.env,
          // Override PWD to simulate running from test directory
          PWD: options.cwd || this.tempDir || this.originalCwd
        }
      });

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
          code,
          exitCode: code, // Add exitCode for test compatibility  
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: code === 0
        });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Set timeout
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`CLI command timed out: ${command} ${args.join(' ')}`));
      }, options.timeout || 10000);

      child.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Create a test file structure
   */
  async createFileStructure(structure, basePath = this.tempDir) {
    for (const [name, content] of Object.entries(structure)) {
      const fullPath = path.join(basePath, name);
      
      if (typeof content === 'string') {
        // It's a file
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content);
      } else if (typeof content === 'object' && content !== null) {
        // It's a directory
        await fs.ensureDir(fullPath);
        await this.createFileStructure(content, fullPath);
      }
    }
  }

  /**
   * Read file structure into an object
   */
  async readFileStructure(dirPath = this.tempDir) {
    const structure = {};
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          structure[item.name] = await this.readFileStructure(itemPath);
        } else if (item.isFile()) {
          structure[item.name] = await fs.readFile(itemPath, 'utf8');
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      return {};
    }
    
    return structure;
  }

  /**
   * Create a test template generator
   */
  async createTestGenerator(generatorName, templates = {}) {
    const generatorPath = path.join(this.tempDir, '_templates', generatorName);
    await fs.ensureDir(generatorPath);

    for (const [templateName, templateContent] of Object.entries(templates)) {
      const templatePath = path.join(generatorPath, templateName);
      await fs.ensureDir(path.dirname(templatePath));
      await fs.writeFile(templatePath, templateContent);
    }

    return generatorPath;
  }

  /**
   * Assert file exists
   */
  async assertFileExists(filePath) {
    const fullPath = path.resolve(this.tempDir, filePath);
    const exists = await fs.pathExists(fullPath);
    if (!exists) {
      throw new Error(`Expected file to exist: ${filePath}`);
    }
    return true;
  }

  /**
   * Assert file content matches
   */
  async assertFileContent(filePath, expectedContent) {
    await this.assertFileExists(filePath);
    const fullPath = path.resolve(this.tempDir, filePath);
    const actualContent = await fs.readFile(fullPath, 'utf8');
    if (actualContent.trim() !== expectedContent.trim()) {
      throw new Error(`File content mismatch in ${filePath}:\nExpected:\n${expectedContent}\nActual:\n${actualContent}`);
    }
    return true;
  }

  /**
   * Assert file contains text
   */
  async assertFileContains(filePath, expectedSubstring) {
    await this.assertFileExists(filePath);
    const fullPath = path.resolve(this.tempDir, filePath);
    const actualContent = await fs.readFile(fullPath, 'utf8');
    if (!actualContent.includes(expectedSubstring)) {
      throw new Error(`File ${filePath} does not contain expected text: ${expectedSubstring}`);
    }
    return true;
  }

  /**
   * Check if file exists (without throwing)
   */
  async fileExists(filePath) {
    const fullPath = path.resolve(this.tempDir, filePath);
    return await fs.pathExists(fullPath);
  }

  /**
   * Check if directory exists (without throwing)
   */
  async directoryExists(dirPath) {
    const fullPath = path.resolve(this.tempDir, dirPath);
    try {
      const stat = await fs.stat(fullPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Create a directory
   */
  async createDirectory(dirPath) {
    const fullPath = path.resolve(this.tempDir, dirPath);
    await fs.ensureDir(fullPath);
    return fullPath;
  }

  /**
   * Create a file with content
   */
  async createFile(filePath, content = '') {
    const fullPath = path.resolve(this.tempDir, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, 'utf8');
    return fullPath;
  }

  /**
   * Read a file
   */
  async readFile(filePath) {
    const fullPath = path.resolve(this.tempDir, filePath);
    return await fs.readFile(fullPath, 'utf8');
  }

  /**
   * Clean up test resources
   */
  async destroy() {
    // Change back to original directory
    if (this.originalCwd) {
      process.chdir(this.originalCwd);
    }

    // Clean up temp directory
    if (this.tempDir) {
      try {
        await fs.remove(this.tempDir);
      } catch (error) {
        console.warn('Failed to cleanup temp directory:', this.tempDir, error);
      }
      this.tempDir = null;
    }

    // Run additional cleanup functions
    for (const cleanupFn of this.cleanup) {
      try {
        await cleanupFn();
      } catch (error) {
        console.warn('Cleanup function failed:', error);
      }
    }
    this.cleanup = [];
  }

  /**
   * Add cleanup function
   */
  addCleanup(fn) {
    this.cleanup.push(fn);
  }
}

/**
 * Setup test environment
 * @returns {Promise<TestHelper>}
 */
export async function setupTestEnvironment() {
  const helper = new TestHelper();
  await helper.changeToTempDir();
  return helper;
}

/**
 * Cleanup test environment
 * @param {TestHelper} helper 
 * @returns {Promise<void>}
 */
export async function cleanupTestEnvironment(helper) {
  if (helper && typeof helper.destroy === 'function') {
    await helper.destroy();
  }
}

/**
 * Create a mock configuration
 */
export function createMockConfig(overrides = {}) {
  return {
    templatesDir: '_templates',
    outputDir: 'src',
    extensions: ['.njk'],
    filters: {},
    helpers: {},
    ...overrides
  };
}

/**
 * Utility function to wait for a condition
 */
export async function waitFor(conditionFn, timeout = 5000, interval = 100) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await conditionFn();
      if (result) {
        return result;
      }
    } catch (error) {
      // Ignore errors and continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Mock process environment for testing
 */
export function mockEnv(envVars = {}) {
  const originalEnv = { ...process.env };
  
  Object.assign(process.env, envVars);
  
  return () => {
    // Restore original environment
    for (const key of Object.keys(envVars)) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  };
}

export default TestHelper;