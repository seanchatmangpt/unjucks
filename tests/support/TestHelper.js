/**
 * TestHelper class for MCP integration tests
 * Provides utilities for testing CLI commands and MCP server interactions
 */

import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export class TestHelper {
  constructor(tempDir = null) {
    this.tempDir = tempDir;
    this.originalCwd = process.cwd();
  }

  /**
   * Run CLI command and return structured result
   */
  async runCli(command, options = {}) {
    const fullCommand = `node src/cli/index.js ${command}`;
    
    try {
      const result = execSync(fullCommand, {
        cwd: this.originalCwd, // Always run from project root
        encoding: 'utf-8',
        timeout: 30000, // 30 second timeout
        ...options
      });
      
      return {
        exitCode: 0,
        stdout: result.trim(),
        stderr: '',
        success: true
      };
    } catch (error) {
      return {
        exitCode: error.status || 1,
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message || '',
        success: false
      };
    }
  }

  /**
   * Create temporary directory for test
   */
  async createTempDir() {
    if (!this.tempDir) {
      this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-test-'));
    }
    return this.tempDir;
  }

  /**
   * Clean up temporary directory
   */
  async cleanup() {
    if (this.tempDir && await fs.pathExists(this.tempDir)) {
      await fs.remove(this.tempDir);
      this.tempDir = null;
    }
  }

  /**
   * Create test file structure
   */
  async createTestFiles(files) {
    if (!this.tempDir) {
      await this.createTempDir();
    }

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(this.tempDir, filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, content);
    }
  }

  /**
   * Check if file exists in temp directory
   */
  async fileExists(filePath) {
    const fullPath = path.join(this.tempDir, filePath);
    return await fs.pathExists(fullPath);
  }

  /**
   * Read file content from temp directory
   */
  async readFile(filePath) {
    const fullPath = path.join(this.tempDir, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Check if MCP server is available
   */
  async isMCPAvailable() {
    try {
      // Try to run a simple command that would use MCP
      const result = await this.runCli('swarm status');
      return result.exitCode === 0 && !result.stderr.match(/(connection|server|MCP)/i);
    } catch {
      return false;
    }
  }

  /**
   * Assert that command either succeeds or fails with expected MCP error
   */
  assertMCPCommandResult(result, expectedSuccess = true) {
    if (expectedSuccess) {
      // If expecting success, command should succeed
      if (result.exitCode !== 0) {
        // But if it fails, it should be due to MCP connection issues
        expect(result.stderr).toMatch(/(connection|server|MCP|not.*available)/i);
      }
    } else {
      // If expecting failure, it should fail with proper error message
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeTruthy();
      expect(result.stderr).not.toMatch(/undefined|null|\[object Object\]/);
    }
  }

  /**
   * Get project root directory
   */
  getProjectRoot() {
    return path.resolve(this.originalCwd);
  }

  /**
   * Change working directory for tests
   */
  async changeToTempDir() {
    if (!this.tempDir) {
      await this.createTempDir();
    }
    process.chdir(this.tempDir);
  }

  /**
   * Restore original working directory
   */
  restoreWorkingDir() {
    process.chdir(this.originalCwd);
  }
}

/**
 * Custom vitest matchers for better test assertions
 */
export const customMatchers = {
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },

  toContainMCPError(received) {
    const pass = /connection|server|MCP|not.*available/i.test(received);
    if (pass) {
      return {
        message: () => `expected "${received}" not to contain MCP error`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected "${received}" to contain MCP connection error`,
        pass: false,
      };
    }
  }
};