/**
 * Basic CLI Feature Spec - Vitest-Cucumber
 * Converted from features/smoke/basic-cli.feature
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { createTestContext } from '../../support/test-context.js';

// Load the original feature file as reference
const feature = await loadFeature('./features/smoke/basic-cli.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario('CLI version command works', ({ When, Then, And }) => {
    const context = createTestContext();
    
    When('I run "node dist/cli.mjs --version"', async () => {
      try {
        console.log('About to execute version command...');
        console.log('Working directory:', process.cwd());
        const cliPath = `${process.cwd()}/dist/cli.mjs`;
        const command = `node "${cliPath}" --version`;
        console.log('Full command:', command);
        const result = await context.helper.executeCommand(command);
        console.log('Version command raw result:', result);
        context.lastResult = result;
        console.log('Version command result stored:', {
          exitCode: result.exitCode,
          stdout: JSON.stringify(result.stdout),
          stderr: JSON.stringify(result.stderr),
          duration: result.duration
        });
      } catch (error) {
        console.error('Version command error:', error);
        context.lastResult = {
          exitCode: 1,
          stdout: '',
          stderr: String(error),
          duration: 0
        };
      }
    });
    
    Then('the command should exit with code 0', () => {
      expect(context.lastResult?.exitCode).toBe(0);
    });
    
    And('the output should contain version information', () => {
      const output = context.lastResult?.stdout || '';
      console.log('Version output to check:', JSON.stringify(output));
      // The CLI outputs "0.0.0" as version
      expect(output.trim()).toBe('0.0.0');
    });
  });

  Scenario('CLI help command works', ({ When, Then, And }) => {
    const context = createTestContext();
    
    When('I run "node dist/cli.mjs --help"', async () => {
      try {
        console.log('About to execute help command...');
        console.log('Working directory:', process.cwd());
        const cliPath = `${process.cwd()}/dist/cli.mjs`;
        const command = `node "${cliPath}" --help`;
        console.log('Full command:', command);
        const result = await context.helper.executeCommand(command);
        console.log('Help command raw result:', result);
        context.lastResult = result;
        console.log('Help command result stored:', {
          exitCode: result.exitCode,
          stdout: JSON.stringify(result.stdout),
          stderr: JSON.stringify(result.stderr),
          duration: result.duration
        });
      } catch (error) {
        console.error('Help command error:', error);
        context.lastResult = {
          exitCode: 1,
          stdout: '',
          stderr: String(error),
          duration: 0
        };
      }
    });
    
    Then('the command should exit with code 0', () => {
      expect(context.lastResult?.exitCode).toBe(0);
    });
    
    And('the output should contain "COMMANDS"', () => {
      const output = context.lastResult?.stdout || '';
      console.log('Help output to check:', JSON.stringify(output));
      expect(output).toContain('COMMANDS');
    });
  });

  Scenario('CLI list command works', ({ When, Then, And }) => {
    const context = createTestContext();
    
    When('I run "node dist/cli.mjs list"', async () => {
      try {
        console.log('About to execute list command...');
        const cliPath = `${process.cwd()}/dist/cli.mjs`;
        const command = `node "${cliPath}" list`;
        console.log('Full command:', command);
        const result = await context.helper.executeCommand(command);
        console.log('List command raw result:', result);
        context.lastResult = result;
      } catch (error) {
        console.error('List command error:', error);
        context.lastResult = {
          exitCode: 1,
          stdout: '',
          stderr: String(error),
          duration: 0
        };
      }
    });
    
    Then('the command should exit with code 0', () => {
      expect(context.lastResult?.exitCode).toBe(0);
    });
    
    And('the output should contain "Available generators"', () => {
      const output = context.lastResult?.stdout || '';
      expect(output).toContain('Available generators');
    });
  });
});