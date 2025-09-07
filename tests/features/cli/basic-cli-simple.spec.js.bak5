/**
 * Basic CLI Tests - Simple Vitest approach
 * Bypasses vitest-cucumber issues with a direct test implementation
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestContext } from '../../support/test-context.js';
describe('Basic CLI Functionality', () => {
  let context;

  beforeEach(() => {
    context = createTestContext();
  });

  describe('CLI version command works', () => { it('should exit with code 0 and return version information', async () => {
      console.log('[TEST] Starting version command test...');
      console.log('[TEST] Context helper exists });

      // Verify exit code
      expect(result.exitCode).toBe(0);
      
      // Verify output contains version
      expect(result.stdout.trim()).toBe('0.0.0');
    });
  });

  describe('CLI help command works', () => { it('should exit with code 0 and contain COMMANDS in output', async () => {
      console.log('[TEST] Executing help command...');
      
      const result = await context.helper.executeCommand('node dist/cli.mjs --help');
      
      console.log('[TEST] Help command completed });

      // Verify exit code
      expect(result.exitCode).toBe(0);
      
      // Verify output contains COMMANDS
      expect(result.stdout).toContain('COMMANDS');
    });
  });

  describe('CLI list command works', () => { it('should exit with code 0 and contain Available generators in output', async () => {
      console.log('[TEST] Executing list command...');
      
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      
      console.log('[TEST] List command completed });

      // Verify exit code
      expect(result.exitCode).toBe(0);
      
      // Verify output contains expected text
      expect(result.stdout).toContain('Available generators');
    });
  });
});