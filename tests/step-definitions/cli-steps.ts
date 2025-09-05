import { Given, When, Then } from '@cucumber/cucumber';
import { UnjucksWorld } from '../support/world.js';
import * as assert from 'assert';
import * as path from 'node:path';

// =============================================================================
// CLI Command Steps
// =============================================================================

When('I run {string}', async function (this: UnjucksWorld, command: string) {
  const args = command.replace(/^unjucks\s*/, '').split(' ').filter(arg => arg.trim().length > 0);
  await this.executeUnjucksCommand(args);
});

When('I run unjucks without arguments', async function (this: UnjucksWorld) {
  await this.executeUnjucksCommand([]);
});

When('I run unjucks {string}', async function (this: UnjucksWorld, command: string) {
  const args = command.split(' ').filter(arg => arg.trim().length > 0);
  await this.executeUnjucksCommand(args);
});

When('I run unjucks with flags:', async function (this: UnjucksWorld, dataTable) {
  const args: string[] = [];
  for (const row of dataTable.hashes()) {
    if (row.flag && row.value) {
      args.push(row.flag, row.value);
    } else if (row.flag) {
      args.push(row.flag);
    }
  }
  await this.executeUnjucksCommand(args);
});

// =============================================================================
// CLI Validation Steps
// =============================================================================

Then('I should see the help message', async function (this: UnjucksWorld) {
  const output = this.getLastOutput();
  assert.ok(/usage|help|commands/i.test(output), 'Output should contain usage, help, or commands information');
});

Then('I should see the version number', async function (this: UnjucksWorld) {
  const output = this.getLastOutput();
  assert.ok(/\d+\.\d+\.\d+/.test(output), 'Output should contain version number in format x.x.x');
});

Then('I should see an error about {string}', async function (this: UnjucksWorld, errorType: string) {
  this.assertCommandFailed();
  const error = this.getLastError();
  assert.ok(error.toLowerCase().includes(errorType.toLowerCase()), `Error should contain "${errorType}"`);
});

Then('I should see validation error {string}', async function (this: UnjucksWorld, expectedError: string) {
  this.assertCommandFailed();
  const error = this.getLastError();
  assert.ok(error.includes(expectedError), `Error should contain "${expectedError}"`);
});

Then('the command should show available generators', async function (this: UnjucksWorld) {
  this.assertCommandSucceeded();
  const output = this.getLastOutput();
  assert.ok(/generators|available|templates/i.test(output), 'Output should contain generators, available, or templates information');
});

Then('the command should show generator help for {string}', async function (this: UnjucksWorld, generatorName: string) {
  this.assertCommandSucceeded();
  const output = this.getLastOutput();
  assert.ok(output.includes(generatorName), `Output should contain generator name "${generatorName}"`);
  assert.ok(/help|usage|description/i.test(output), 'Output should contain help, usage, or description information');
});

// =============================================================================
// CLI Options and Flags Steps
// =============================================================================

Given('I set the flag {string} to {string}', async function (this: UnjucksWorld, flag: string, value: string) {
  this.setTemplateVariables({ [flag.replace('--', '')]: value });
});

Given('I enable the {string} flag', async function (this: UnjucksWorld, flag: string) {
  this.setTemplateVariables({ [flag.replace('--', '')]: true });
});

When('I run unjucks with {string} flag', async function (this: UnjucksWorld, flag: string) {
  await this.executeUnjucksCommand([flag]);
});

When('I run unjucks with {string} set to {string}', async function (this: UnjucksWorld, flag: string, value: string) {
  await this.executeUnjucksCommand([flag, value]);
});

Then('the {string} option should be {string}', async function (this: UnjucksWorld, option: string, expectedValue: string) {
  const variables = this.getTemplateVariables();
  assert.strictEqual(variables[option], expectedValue, `Option "${option}" should be "${expectedValue}"`);
});

// =============================================================================
// CLI Prompts and Interactive Steps
// =============================================================================

Given('I will provide the following prompt responses:', async function (this: UnjucksWorld, dataTable) {
  const responses: Record<string, string> = {};
  for (const row of dataTable.hashes()) {
    responses[row.prompt || row.question] = row.response || row.answer;
  }
  this.setTemplateVariables({ _promptResponses: responses });
});

When('I am prompted for {string}', async function (this: UnjucksWorld, promptName: string) {
  // This step would be used in conjunction with interactive command execution
  // For now, we'll just verify that the prompt system is aware of this prompt
  const variables = this.getTemplateVariables();
  if (variables._promptResponses && variables._promptResponses[promptName]) {
    // Simulate providing the response
    this.setTemplateVariables({ [promptName]: variables._promptResponses[promptName] });
  }
});

Then('I should be prompted for {string}', async function (this: UnjucksWorld, expectedPrompt: string) {
  const output = this.getLastOutput();
  assert.ok(output.includes(expectedPrompt), `Output should contain prompt "${expectedPrompt}"`);
});

Then('I should not be prompted for any input', async function (this: UnjucksWorld) {
  const output = this.getLastOutput();
  // Check that there are no common prompt indicators
  assert.ok(!/\?\s*$/m.test(output), 'Output should not contain question mark prompts');
  assert.ok(!/:\s*$/m.test(output), 'Output should not contain colon prompts');
});

// =============================================================================
// CLI Command Discovery Steps
// =============================================================================

When('I list all available commands', async function (this: UnjucksWorld) {
  await this.executeUnjucksCommand(['--help']);
});

When('I check command {string} exists', async function (this: UnjucksWorld, commandName: string) {
  await this.executeUnjucksCommand([commandName, '--help']);
});

Then('I should see command {string} in the list', async function (this: UnjucksWorld, commandName: string) {
  const output = this.getLastOutput();
  assert.ok(output.includes(commandName), `Output should contain command name "${commandName}"`);
});

Then('command {string} should be available', async function (this: UnjucksWorld, commandName: string) {
  this.assertCommandSucceeded();
  const output = this.getLastOutput();
  assert.ok(new RegExp(commandName, 'i').test(output), `Output should contain command "${commandName}" (case insensitive)`);
});

// =============================================================================
// CLI Error Handling Steps
// =============================================================================

When('I run an invalid command {string}', async function (this: UnjucksWorld, invalidCommand: string) {
  const args = invalidCommand.split(' ').filter(arg => arg.trim().length > 0);
  await this.executeUnjucksCommand(args);
});

When('I run unjucks with invalid flag {string}', async function (this: UnjucksWorld, invalidFlag: string) {
  await this.executeUnjucksCommand([invalidFlag]);
});

Then('I should see a helpful error message', async function (this: UnjucksWorld) {
  this.assertCommandFailed();
  const error = this.getLastError() + this.getLastOutput();
  
  // Should contain helpful guidance
  const helpfulPatterns = [
    /usage/i,
    /help/i,
    /try/i,
    /available/i,
    /invalid/i,
    /unknown/i
  ];
  
  const hasHelpfulContent = helpfulPatterns.some(pattern => pattern.test(error));
  assert.strictEqual(hasHelpfulContent, true, 'Error message should contain helpful guidance');
});

Then('I should see suggestion to use {string}', async function (this: UnjucksWorld, suggestedCommand: string) {
  const error = this.getLastError() + this.getLastOutput();
  assert.ok(error.includes(suggestedCommand), `Error should suggest using command "${suggestedCommand}"`);
});

// =============================================================================
// Environment and Context Steps
// =============================================================================

Given('I am in a directory without templates', async function (this: UnjucksWorld) {
  // Temp directory is clean by default - no _templates directory
  const templatesDir = path.join(this.context.tempDirectory, '_templates');
  // Ensure it doesn't exist
  const fs = await import('fs-extra');
  if (await fs.pathExists(templatesDir)) {
    await fs.remove(templatesDir);
  }
});

Given('I am in a directory with invalid templates', async function (this: UnjucksWorld) {
  // Create a malformed template structure
  await this.createTemplateStructure({
    'invalid/malformed.txt': 'This is not a valid template file',
    'invalid/no-frontmatter.js': 'console.log("No frontmatter");'
  });
});

Then('I should see a message about no templates found', async function (this: UnjucksWorld) {
  const output = this.getLastOutput() + this.getLastError();
  assert.ok(/no templates?|templates? not found|empty/i.test(output), 'Output should indicate no templates found');
});

Then('I should see context information', async function (this: UnjucksWorld) {
  const output = this.getLastOutput();
  assert.ok(/directory|path|context|current/i.test(output), 'Output should contain context information about directory or path');
});