/**
 * Basic CLI Feature Spec - Vitest-Cucumber
 * Converted from features/smoke/basic-cli.feature
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect, test, describe } from 'vitest';
import { createTestContext } from '../../support/test-context.js';
import type { CLIResult } from '../../support/TestHelper.js';

// Load the original feature file as reference
const feature = await loadFeature('./features/smoke/basic-cli.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario('CLI version command works', ({ When, Then, And }) => {
    let testResult: CLIResult;
    
    When('I run "node dist/cli.mjs --version"', async () => {
      console.log('[TEST] Executing version command...');
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs --version');
      testResult = result; // Store in scenario-scoped variable
      console.log('[TEST] Version command completed:', {
        exitCode: result.exitCode,
        stdoutLength: result.stdout.length,
        stdout: JSON.stringify(result.stdout),
        stderr: JSON.stringify(result.stderr)
      });
    });
    
    Then('the command should exit with code 0', () => {
      console.log('[TEST] Checking version exit code:', testResult?.exitCode);
      expect(testResult?.exitCode).toBe(0);
    });
    
    And('the output should contain version information', () => {
      const output = testResult?.stdout || '';
      console.log('[TEST] Version output to check:', JSON.stringify(output));
      // The CLI outputs "0.0.0" as version
      expect(output.trim()).toBe('0.0.0');
    });
  });

  Scenario('CLI help command works', ({ When, Then, And }) => {
    let testResult: CLIResult;
    
    When('I run "node dist/cli.mjs --help"', async () => {
      console.log('[TEST] Executing help command...');
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs --help');
      testResult = result; // Store in scenario-scoped variable
      console.log('[TEST] Help command completed:', {
        exitCode: result.exitCode,
        stdoutLength: result.stdout.length,
        stdout: JSON.stringify(result.stdout.substring(0, 100)),
        stderr: JSON.stringify(result.stderr)
      });
    });
    
    Then('the command should exit with code 0', () => {
      console.log('[TEST] Checking help exit code:', testResult?.exitCode);
      expect(testResult?.exitCode).toBe(0);
    });
    
    And('the output should contain "COMMANDS"', () => {
      const output = testResult?.stdout || '';
      console.log('[TEST] Help output to check contains COMMANDS:', JSON.stringify(output));
      expect(output).toContain('COMMANDS');
    });
  });

  Scenario('CLI list command works', ({ When, Then, And }) => {
    let testResult: CLIResult;
    
    When('I run "node dist/cli.mjs list"', async () => {
      console.log('[TEST] Executing list command...');
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      testResult = result; // Store in scenario-scoped variable
      console.log('[TEST] List command completed:', {
        exitCode: result.exitCode,
        stdoutLength: result.stdout.length,
        stdout: JSON.stringify(result.stdout.substring(0, 100)),
        stderr: JSON.stringify(result.stderr)
      });
    });
    
    Then('the command should exit with code 0', () => {
      console.log('[TEST] Checking list exit code:', testResult?.exitCode);
      expect(testResult?.exitCode).toBe(0);
    });
    
    And('the output should contain "Available generators"', () => {
      const output = testResult?.stdout || '';
      console.log('[TEST] List output to check contains Available generators:', JSON.stringify(output));
      expect(output).toContain('Available generators');
    });
  });
});