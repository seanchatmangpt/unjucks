/**
 * Test Setup for KGEN CLI
 * Provides utilities and global test configuration
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Global test utilities
global.testUtils = {
  // Create temporary directory for tests
  async createTempDir(prefix = 'kgen-test-') {
    return await mkdtemp(resolve(tmpdir(), prefix));
  },

  // Cleanup temporary directory
  async cleanupTempDir(dir) {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup ${dir}:`, error.message);
    }
  },

  // Execute CLI command
  async execCLI(args, options = {}) {
    return new Promise((resolve) => {
      const binPath = resolve(__dirname, '..', 'bin', 'kgen.js');
      const child = spawn('node', [binPath, ...args], {
        cwd: options.cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...options.env }
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
          exitCode: code,
          stdout,
          stderr,
          success: code === 0
        });
      });

      // Set timeout
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          exitCode: -1,
          stdout,
          stderr: stderr + '\nTest timeout',
          success: false
        });
      }, options.timeout || 10000);
    });
  },

  // Wait for file to exist
  async waitForFile(filePath, timeout = 5000) {
    const { access } = await import('fs/promises');
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        await access(filePath);
        return true;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    return false;
  }
};

// Create fixtures directory if it doesn't exist
const fixturesDir = resolve(__dirname, 'fixtures');
try {
  await import('fs/promises').then(fs => fs.mkdir(fixturesDir, { recursive: true }));
} catch (error) {
  // Directory already exists or other error
}

// Set test-specific environment variables
process.env.NODE_ENV = 'test';
process.env.KGEN_LOG_LEVEL = 'warn';
process.env.KGEN_CACHE_DISABLED = 'true';