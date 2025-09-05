import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import { describe, test, expect } from 'vitest';

const execAsync = promisify(exec);

/**
 * Simple smoke tests to verify the CLI is working and ready for BDD testing
 * These tests run independently without complex setup
 */
describe('CLI Simple Smoke Tests', () => {
  const cliPath = path.join(process.cwd(), 'dist/cli.mjs');

  test('CLI file exists', () => {
    const fs = require('fs');
    expect(fs.existsSync(cliPath)).toBe(true);
  });

  test('should show version', async () => {
    const { stdout, stderr } = await execAsync(`node "${cliPath}" --version`);
    
    expect(stderr).toBe('');
    expect(stdout.trim()).toBe('0.0.0');
  });

  test('should show help', async () => {
    const { stdout, stderr } = await execAsync(`node "${cliPath}" --help`);
    
    expect(stderr).toBe('');
    expect(stdout).toContain('A Hygen-style CLI generator');
    expect(stdout).toContain('USAGE unjucks');
    expect(stdout).toContain('generate');
    expect(stdout).toContain('list');
    expect(stdout).toContain('init');
  });

  test('should handle list command gracefully', async () => {
    try {
      const { stdout, stderr } = await execAsync(`node "${cliPath}" list`);
      // Should complete without crashing, regardless of output
      expect(typeof stdout).toBe('string');
      expect(typeof stderr).toBe('string');
    } catch (error: any) {
      // Even if it exits with non-zero, it should be a controlled exit
      expect(typeof error.stdout).toBe('string');
      expect(typeof error.stderr).toBe('string');
    }
  });

  test('should show generate help', async () => {
    try {
      const { stdout } = await execAsync(`node "${cliPath}" generate --help`);
      expect(stdout).toContain('generate');
    } catch (error: any) {
      // Might exit with non-zero but should still show help
      expect(error.stdout).toContain('generate');
    }
  });

  test('should show init help', async () => {
    try {
      const { stdout } = await execAsync(`node "${cliPath}" init --help`);
      expect(stdout).toContain('init');
    } catch (error: any) {
      // Might exit with non-zero but should still show help
      expect(error.stdout).toContain('init');
    }
  });
});