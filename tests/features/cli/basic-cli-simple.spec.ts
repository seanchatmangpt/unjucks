/**
 * Basic CLI Tests - Simple Vitest approach
 * Bypasses vitest-cucumber issues with a direct test implementation
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestContext } from '../../support/test-context.js';
import type { TestContext } from '../../support/test-context.js';
import type { CLIResult } from '../../support/TestHelper.js';

describe('Basic CLI Functionality', () => {
  let context: TestContext;

  beforeEach(() => {
    context = createTestContext();
  });

  describe('CLI version command works', () => {
    it('should exit with code 0 and return version information', async () => {
      console.log('[TEST] Starting version command test...');
      console.log('[TEST] Context helper exists:', !!context.helper);
      console.log('[TEST] Context helper executeCommand exists:', !!context.helper.executeCommand);
      
      const result = await context.helper.executeCommand('node dist/cli.mjs --version');
      
      console.log('[TEST] Version command result received:', {
        exitCode: result.exitCode,
        stdoutLength: result.stdout.length,
        stderrLength: result.stderr.length,
        stdout: JSON.stringify(result.stdout),
        stderr: JSON.stringify(result.stderr),
        duration: result.duration
      });

      // Verify exit code
      expect(result.exitCode).toBe(0);
      
      // Verify output contains version
      expect(result.stdout.trim()).toBe('0.0.0');
    });
  });

  describe('CLI help command works', () => {
    it('should exit with code 0 and contain COMMANDS in output', async () => {
      console.log('[TEST] Executing help command...');
      
      const result = await context.helper.executeCommand('node dist/cli.mjs --help');
      
      console.log('[TEST] Help command completed:', {
        exitCode: result.exitCode,
        stdoutLength: result.stdout.length,
        stdout: JSON.stringify(result.stdout.substring(0, 200)),
        stderr: JSON.stringify(result.stderr)
      });

      // Verify exit code
      expect(result.exitCode).toBe(0);
      
      // Verify output contains COMMANDS
      expect(result.stdout).toContain('COMMANDS');
    });
  });

  describe('CLI list command works', () => {
    it('should exit with code 0 and contain Available generators in output', async () => {
      console.log('[TEST] Executing list command...');
      
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      
      console.log('[TEST] List command completed:', {
        exitCode: result.exitCode,
        stdoutLength: result.stdout.length,
        stdout: JSON.stringify(result.stdout.substring(0, 200)),
        stderr: JSON.stringify(result.stderr)
      });

      // Verify exit code
      expect(result.exitCode).toBe(0);
      
      // Verify output contains expected text
      expect(result.stdout).toContain('Available generators');
    });
  });
});