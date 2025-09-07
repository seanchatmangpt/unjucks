// Test utilities for JavaScript test environment
import { vi, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';

/**
 * Create a temporary test directory
 */
export function createTempDir(prefix = 'unjucks-test-') {
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'temp', prefix));
  return tempDir;
}

/**
 * Clean up test directory
 */
export function cleanupTempDir(dir) {
  if (fs.existsSync(dir)) {
    fs.removeSync(dir);
  }
}

/**
 * Mock console methods for testing
 */
export function mockConsole() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  const mockLog = vi.fn();
  const mockError = vi.fn();
  const mockWarn = vi.fn();
  
  console.log = mockLog;
  console.error = mockError;
  console.warn = mockWarn;
  
  return {
    mockLog,
    mockError,
    mockWarn,
    restore() {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }
  };
}

/**
 * Test helper for CLI commands
 */
export async function execCLI(args = [], options = {}) {
  const { spawn } = await import('child_process');
  const { promisify } = await import('util');
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['src/cli/index.js', ...args], {
      stdio: 'pipe',
      cwd: process.cwd(),
      ...options
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
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
    
    child.on('error', reject);
    
    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      reject(new Error('CLI command timeout'));
    }, 30000);
  });
}

/**
 * Test helper to check if file exists
 */
export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Test helper to read file contents
 */
export function readTestFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Test helper to write test file
 */
export function writeTestFile(filePath, content) {
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}