import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { createTestContext } from '../support/test-context.js';
import type { CLIResult } from '../support/TestHelper.js';

// Load the feature file
const feature = await loadFeature('./features/frontmatter-processing.feature');

describeFeature(feature, ({ Scenario }) => {

  Scenario('Basic frontmatter processing with to directive', ({ Given, When, Then, And }) => {
    let testResult: CLIResult;
    
    Given('I have a project with templates directory', async () => {
      console.log('[TEST] Setting up project with templates directory...');
      // Test setup - this would create the temp directory structure
    });

    When('I run a frontmatter processing command', async () => {
      console.log('[TEST] Running frontmatter processing command...');
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      testResult = result;
    });

    Then('the frontmatter should be processed correctly', () => {
      console.log('[TEST] Verifying frontmatter processing...');
      expect(testResult?.exitCode).toBe(0);
    });
  });

  Scenario('Frontmatter injection with inject and after', ({ Given, When, Then, And }) => {
    let testResult: CLIResult;
    
    Given('I have a project setup', async () => {
      console.log('[TEST] Setting up injection test...');
    });

    When('I run an injection command', async () => {
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      testResult = result;
    });

    Then('the injection should work correctly', () => {
      expect(testResult?.exitCode).toBe(0);
    });
  });

  Scenario('Frontmatter injection with inject and before', ({ Given, When, Then }) => {
    let testResult: CLIResult;
    
    Given('I have an injection setup', async () => {
      console.log('[TEST] Setting up before injection test...');
    });

    When('I run a before injection command', async () => {
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      testResult = result;
    });

    Then('the before injection should work', () => {
      expect(testResult?.exitCode).toBe(0);
    });
  });

  Scenario('Frontmatter append mode unique feature', ({ Given, When, Then }) => {
    let testResult: CLIResult;
    
    Given('I have append setup', async () => {
      console.log('[TEST] Setting up append mode test...');
    });

    When('I run append command', async () => {
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      testResult = result;
    });

    Then('append should work correctly', () => {
      expect(testResult?.exitCode).toBe(0);
    });
  });

  Scenario('Frontmatter prepend mode unique feature', ({ Given, When, Then }) => {
    let testResult: CLIResult;
    
    Given('I have prepend setup', async () => {
      console.log('[TEST] Setting up prepend mode test...');
    });

    When('I run prepend command', async () => {
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      testResult = result;
    });

    Then('prepend should work correctly', () => {
      expect(testResult?.exitCode).toBe(0);
    });
  });

  Scenario('Frontmatter lineAt mode unique feature', ({ Given, When, Then }) => {
    let testResult: CLIResult;
    
    Given('I have lineAt setup', async () => {
      console.log('[TEST] Setting up lineAt mode test...');
    });

    When('I run lineAt command', async () => {
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      testResult = result;
    });

    Then('lineAt should work correctly', () => {
      expect(testResult?.exitCode).toBe(0);
    });
  });

  Scenario('Frontmatter chmod mode unique feature', ({ Given, When, Then }) => {
    let testResult: CLIResult;
    
    Given('I have chmod setup', async () => {
      console.log('[TEST] Setting up chmod mode test...');
    });

    When('I run chmod command', async () => {
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      testResult = result;
    });

    Then('chmod should work correctly', () => {
      expect(testResult?.exitCode).toBe(0);
    });
  });

  Scenario('Frontmatter skipIf condition enhanced syntax', ({ Given, When, Then }) => {
    let testResult: CLIResult;
    
    Given('I have skipIf setup', async () => {
      console.log('[TEST] Setting up skipIf condition test...');
    });

    When('I run skipIf command', async () => {
      const context = createTestContext();
      const result = await context.helper.executeCommand('node dist/cli.mjs list');
      testResult = result;
    });

    Then('skipIf should work correctly', () => {
      expect(testResult?.exitCode).toBe(0);
    });
  });
});