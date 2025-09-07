/**
 * Basic CLI Feature Spec - Vitest-Cucumber
 * Converted from features/smoke/basic-cli.feature
 */
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect, test, describe } from 'vitest';
import { createTestContext } from '../../support/test-context.js';
// Load the original feature file
const feature = await loadFeature('./features/smoke/basic-cli.feature');

describeFeature(feature, ({ Scenario }) => {
  Scenario('CLI version command works', ({ When, Then, And }) => { let testResult;
    
    When('I run "node dist/cli.mjs --version"', async () => {
      console.log('[TEST] Executing version command...');
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs --version');
      testResult = result; // Store in scenario-scoped variable
      console.log('[TEST] Version command completed });
    });
    
    Then('the command should exit with code 0', () => { console.log('[TEST] Checking version exit code });
    
    And('the output should contain version information', () => { const output = testResult?.stdout || '';
      console.log('[TEST] Version output to check });
  });

  Scenario('CLI help command works', ({ When, Then, And }) => { let testResult;
    
    When('I run "node dist/cli.mjs --help"', async () => {
      console.log('[TEST] Executing help command...');
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs --help');
      testResult = result; // Store in scenario-scoped variable
      console.log('[TEST] Help command completed });
    });
    
    Then('the command should exit with code 0', () => { console.log('[TEST] Checking help exit code });
    
    And('the output should contain "COMMANDS"', () => { const output = testResult?.stdout || '';
      console.log('[TEST] Help output to check contains COMMANDS });
  });

  Scenario('CLI list command works', ({ When, Then, And }) => { let testResult;
    
    When('I run "node dist/cli.mjs list"', async () => {
      console.log('[TEST] Executing list command...');
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      testResult = result; // Store in scenario-scoped variable
      console.log('[TEST] List command completed });
    });
    
    Then('the command should exit with code 0', () => { console.log('[TEST] Checking list exit code });
    
    And('the output should contain "Available generators"', () => { const output = testResult?.stdout || '';
      console.log('[TEST] List output to check contains Available generators });
  });
});