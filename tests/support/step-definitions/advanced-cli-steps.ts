import { Given, When, Then } from '@cucumber/cucumber';
import { UnjucksWorld } from '../world';
import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Advanced CLI Steps Library
 * Comprehensive step definitions for complex command patterns, variable substitution,
 * output parsing, and advanced CLI scenarios
 */

// Command execution with variable substitution
Given('I set the environment variable {string} to {string}', async function (this: UnjucksWorld, name: string, value: string) {
  this.context.environmentVariables[name] = value;
  process.env[name] = value;
});

When('I run {string} with variables:', async function (this: UnjucksWorld, command: string, variableTable: any) {
  // Parse variables from data table
  const variables = variableTable.hashes()[0] || {};
  
  // Substitute variables in command
  let substitutedCommand = command;
  for (const [key, value] of Object.entries(variables)) {
    substitutedCommand = substitutedCommand.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value as string);
  }
  
  // Store variables for later use
  Object.assign(this.context.templateVariables, variables);
  
  const result = await this.helper.runCli(substitutedCommand);
  this.setLastCommandResult(result);
});

When('I run {string} with flags:', async function (this: UnjucksWorld, baseCommand: string, flagTable: any) {
  const flags = flagTable.hashes();
  let command = baseCommand;
  
  for (const flag of flags) {
    if (flag.value) {
      command += ` --${flag.name} ${flag.value}`;
    } else {
      command += ` --${flag.name}`;
    }
  }
  
  const result = await this.helper.runCli(command);
  this.setLastCommandResult(result);
});

When('I run {string} in directory {string}', async function (this: UnjucksWorld, command: string, directory: string) {
  const originalCwd = process.cwd();
  const targetDir = path.resolve(this.context.tempDirectory!, directory);
  
  try {
    process.chdir(targetDir);
    const result = await this.helper.runCli(command);
    this.setLastCommandResult(result);
  } finally {
    process.chdir(originalCwd);
  }
});

When('I run the command pipeline:', async function (this: UnjucksWorld, commandTable: any) {
  const commands = commandTable.hashes();
  const results: any[] = [];
  
  for (const commandRow of commands) {
    const { command, expectSuccess } = commandRow;
    const result = await this.helper.runCli(command);
    results.push(result);
    
    if (expectSuccess === 'true' && result.exitCode !== 0) {
      throw new Error(`Command '${command}' failed with exit code ${result.exitCode}. Output: ${result.stderr}`);
    }
  }
  
  this.context.pipelineResults = results;
  this.setLastCommandResult(results[results.length - 1]);
});

// Advanced output validation
Then('the output should match pattern {string}', function (this: UnjucksWorld, pattern: string) {
  const result = this.getLastCommandResult();
  const regex = new RegExp(pattern);
  
  if (!regex.test(result.stdout)) {
    throw new Error(`Output does not match pattern '${pattern}'. Actual output: ${result.stdout}`);
  }
});

Then('the output should contain JSON with:', function (this: UnjucksWorld, jsonTable: any) {
  const result = this.getLastCommandResult();
  const expectedData = jsonTable.hashes()[0];
  
  let actualJson;
  try {
    actualJson = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Output is not valid JSON: ${result.stdout}`);
  }
  
  for (const [key, expectedValue] of Object.entries(expectedData)) {
    assert.strictEqual(actualJson[key], expectedValue, `JSON key '${key}' mismatch`);
  }
});

Then('the output should contain table with headers:', function (this: UnjucksWorld, headerTable: any) {
  const result = this.getLastCommandResult();
  const expectedHeaders = headerTable.hashes().map((h: any) => h.header);
  
  for (const header of expectedHeaders) {
    if (!result.stdout.includes(header)) {
      throw new Error(`Output missing expected header '${header}'. Actual output: ${result.stdout}`);
    }
  }
});

Then('the output should contain exactly {int} lines', function (this: UnjucksWorld, expectedLines: number) {
  const result = this.getLastCommandResult();
  const actualLines = result.stdout.split('\n').filter(line => line.trim()).length;
  
  assert.strictEqual(actualLines, expectedLines, `Expected ${expectedLines} lines, got ${actualLines}`);
});

Then('each line should match pattern {string}', function (this: UnjucksWorld, pattern: string) {
  const result = this.getLastCommandResult();
  const lines = result.stdout.split('\n').filter(line => line.trim());
  const regex = new RegExp(pattern);
  
  for (let i = 0; i < lines.length; i++) {
    if (!regex.test(lines[i])) {
      throw new Error(`Line ${i + 1} does not match pattern '${pattern}'. Line: '${lines[i]}'`);
    }
  }
});

// Performance and timing
Then('the command should complete within {int} seconds', function (this: UnjucksWorld, seconds: number) {
  const result = this.getLastCommandResult();
  if (!result.duration) {
    throw new Error('Command duration not recorded');
  }
  
  const actualSeconds = result.duration / 1000;
  if (actualSeconds > seconds) {
    throw new Error(`Command took ${actualSeconds}s, expected within ${seconds}s`);
  }
});

Then('the command should use less than {int}MB memory', function (this: UnjucksWorld, maxMemoryMB: number) {
  const result = this.getLastCommandResult();
  if (result.memoryUsage && result.memoryUsage > maxMemoryMB * 1024 * 1024) {
    throw new Error(`Command used ${result.memoryUsage / (1024 * 1024)}MB, expected less than ${maxMemoryMB}MB`);
  }
});

// Interactive command handling
When('I run {string} and answer prompts:', async function (this: UnjucksWorld, command: string, promptTable: any) {
  const prompts = promptTable.hashes();
  const answers: Record<string, string> = {};
  
  for (const prompt of prompts) {
    answers[prompt.question] = prompt.answer;
  }
  
  // Store answers for mock prompt handling
  this.context.promptAnswers = answers;
  
  const result = await this.helper.runCliWithPrompts(command, answers);
  this.setLastCommandResult(result);
});

// Command validation
Then('the command should suggest {string}', function (this: UnjucksWorld, expectedSuggestion: string) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  
  if (!output.includes(expectedSuggestion)) {
    throw new Error(`Expected suggestion '${expectedSuggestion}' not found in output: ${output}`);
  }
});

Then('the help text should contain sections:', function (this: UnjucksWorld, sectionTable: any) {
  const result = this.getLastCommandResult();
  const expectedSections = sectionTable.hashes().map((s: any) => s.section);
  
  for (const section of expectedSections) {
    if (!result.stdout.includes(section)) {
      throw new Error(`Help text missing section '${section}'. Actual output: ${result.stdout}`);
    }
  }
});

// Command state management
Given('I have previously run {string}', async function (this: UnjucksWorld, command: string) {
  const result = await this.helper.runCli(command);
  this.context.previousCommands = this.context.previousCommands || [];
  this.context.previousCommands.push({ command, result });
});

Then('the current output should differ from the previous run', function (this: UnjucksWorld) {
  const currentResult = this.getLastCommandResult();
  const previousCommands = this.context.previousCommands || [];
  
  if (previousCommands.length === 0) {
    throw new Error('No previous commands to compare against');
  }
  
  const lastPrevious = previousCommands[previousCommands.length - 1];
  if (currentResult.stdout === lastPrevious.result.stdout) {
    throw new Error('Output is identical to previous run when it should differ');
  }
});

// Advanced error handling
Then('the error should be a {string} error with code {int}', function (this: UnjucksWorld, errorType: string, errorCode: number) {
  const result = this.getLastCommandResult();
  
  assert.notStrictEqual(result.exitCode, 0, 'Command should have failed');
  assert.strictEqual(result.exitCode, errorCode, `Expected exit code ${errorCode}, got ${result.exitCode}`);
  
  const errorOutput = result.stderr || result.stdout;
  if (!errorOutput.toLowerCase().includes(errorType.toLowerCase())) {
    throw new Error(`Expected '${errorType}' error type. Actual error: ${errorOutput}`);
  }
});

Then('the error message should include troubleshooting steps', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const errorOutput = result.stderr || result.stdout;
  
  const troubleshootingKeywords = ['try', 'check', 'ensure', 'verify', 'run', 'install'];
  const hasTS = troubleshootingKeywords.some(keyword => 
    errorOutput.toLowerCase().includes(keyword)
  );
  
  if (!hasTS) {
    throw new Error(`Error message should include troubleshooting steps. Error: ${errorOutput}`);
  }
});

// Configuration and environment
Given('the unjucks config contains:', function (this: UnjucksWorld, configTable: any) {
  const config = configTable.hashes()[0];
  this.context.config = { ...this.context.config, ...config };
});

When('I run {string} with environment {string}', async function (this: UnjucksWorld, command: string, environment: string) {
  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = environment;
  
  try {
    const result = await this.helper.runCli(command);
    this.setLastCommandResult(result);
  } finally {
    process.env.NODE_ENV = oldEnv;
  }
});

// Debugging and introspection
When('I run {string} with debug output', async function (this: UnjucksWorld, command: string) {
  const result = await this.helper.runCli(command + ' --debug');
  this.setLastCommandResult(result);
});

Then('the debug output should show:', function (this: UnjucksWorld, debugTable: any) {
  const result = this.getLastCommandResult();
  const expectedDebugInfo = debugTable.hashes();
  
  for (const info of expectedDebugInfo) {
    if (!result.stdout.includes(info.information)) {
      throw new Error(`Debug output missing '${info.information}'. Actual: ${result.stdout}`);
    }
  }
});

// Factory function for creating advanced CLI steps
export function createAdvancedCliSteps(context?: any) {
  return {
    // Export all step definitions for programmatic use
    environmentVariable: Given,
    runWithVariables: When,
    runWithFlags: When,
    runInDirectory: When,
    commandPipeline: When,
    matchPattern: Then,
    containsJson: Then,
    containsTable: Then,
    exactLines: Then,
    linesMatchPattern: Then,
    completeWithinTime: Then,
    useMemoryLimit: Then,
    runWithPrompts: When,
    shouldSuggest: Then,
    helpTextSections: Then,
    previouslyRun: Given,
    outputDiffer: Then,
    errorTypeWithCode: Then,
    troubleshootingSteps: Then,
    configContains: Given,
    runWithEnvironment: When,
    runWithDebug: When,
    debugOutputShows: Then
  };
}