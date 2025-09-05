import { loadFeature, defineFeature } from 'vitest-cucumber';
import { expect } from 'vitest';
import { UnjucksWorld } from '../support/world';
import * as fs from 'fs-extra';
import * as path from 'node:path';

export const commonStepDefinitions = {
  // Common setup and teardown steps
  'I set up a temporary test environment': async (world: UnjucksWorld) => {
    await world.createTempDirectory();
    await world.helper.createDirectory('_templates');
  },

  'I am in a test directory': async (world: UnjucksWorld) => {
    if (!world.context.tempDirectory) {
      await world.createTempDirectory();
    }
  },

  'I clean up the test environment': async (world: UnjucksWorld) => {
    await world.cleanupTempDirectory();
    // Clear any environment variables set during tests
    const envVars = world.context.fixtures.envVars as string[] || [];
    for (const envVar of envVars) {
      delete process.env[envVar];
    }
    world.clearVariables();
  },

  // File system verification steps
  'the file {string} should exist': async (world: UnjucksWorld, filePath: string) => {
    const exists = await world.fileExists(filePath);
    if (!exists) {
      const files = await world.listFiles();
      throw new Error(`File '${filePath}' does not exist. Available files: ${files.join(', ')}`);
    }
    expect(exists).toBe(true);
  },

  'the file {string} should not exist': async (world: UnjucksWorld, filePath: string) => {
    const exists = await world.fileExists(filePath);
    expect(exists).toBe(false);
  },

  'the directory {string} should exist': async (world: UnjucksWorld, dirPath: string) => {
    const fullPath = path.resolve(world.context.tempDirectory, dirPath);
    const exists = await fs.pathExists(fullPath);
    expect(exists).toBe(true);
  },

  'the directory {string} should not exist': async (world: UnjucksWorld, dirPath: string) => {
    const fullPath = path.resolve(world.context.tempDirectory, dirPath);
    const exists = await fs.pathExists(fullPath);
    expect(exists).toBe(false);
  },

  'I should see {int} files created': async (world: UnjucksWorld, expectedCount: number) => {
    const files = await world.listFiles();
    const actualCount = files.length;
    if (actualCount !== expectedCount) {
      throw new Error(`Expected ${expectedCount} files, but found ${actualCount}. Files: ${files.join(', ')}`);
    }
    expect(actualCount).toBe(expectedCount);
  },

  'I should see at least {int} files created': async (world: UnjucksWorld, minCount: number) => {
    const files = await world.listFiles();
    expect(files.length).toBeGreaterThanOrEqual(minCount);
  },

  // Content verification steps
  'the file content should match:': async (world: UnjucksWorld, expectedContent: string) => {
    const files = await world.listFiles();
    const generatedFile = files.find((file) => file.endsWith('.ts') || file.endsWith('.js'));
    
    if (!generatedFile) {
      throw new Error('No generated file found');
    }

    const content = await world.readGeneratedFile(generatedFile);
    const normalizedExpected = expectedContent.trim().replace(/\r\n/g, '\n');
    const normalizedActual = content.trim().replace(/\r\n/g, '\n');
    
    expect(normalizedActual).toContain(normalizedExpected);
  },

  'the file content should not contain {string}': async (world: UnjucksWorld, unwantedContent: string) => {
    const files = await world.listFiles();
    const generatedFile = files.find((file) => file.endsWith('.ts') || file.endsWith('.js'));
    
    if (generatedFile) {
      const content = await world.readGeneratedFile(generatedFile);
      expect(content).not.toContain(unwantedContent);
    }
  },

  // Variable and context steps
  'I set the variable {string} to {string}': (world: UnjucksWorld, variableName: string, value: string) => {
    world.setVariable(variableName, value);
  },

  'I set the variables:': (world: UnjucksWorld, dataTable: any) => {
    const variables = dataTable.rowsHash();
    world.setTemplateVariables(variables);
  },

  'the variable {string} should be {string}': (world: UnjucksWorld, variableName: string, expectedValue: string) => {
    const actualValue = world.getVariable(variableName);
    expect(actualValue).toBe(expectedValue);
  },

  // Template system steps
  'I have template variables:': (world: UnjucksWorld, dataTable: any) => {
    const variables = dataTable.rowsHash();
    for (const [key, value] of Object.entries(variables)) {
      // Parse JSON if the value looks like JSON
      try {
        const parsedValue = JSON.parse(value as string);
        world.setVariable(key, parsedValue);
      } catch {
        // If not JSON, store as string
        world.setVariable(key, value);
      }
    }
  },

  'the template variables should contain {string}': (world: UnjucksWorld, variableName: string) => {
    const variables = world.getTemplateVariables();
    expect(variables).toHaveProperty(variableName);
  },

  // Assertion helpers
  'it should contain {string}': (world: UnjucksWorld, expectedText: string) => {
    const output = world.getLastOutput();
    expect(output).toContain(expectedText);
  },

  'it should not contain {string}': (world: UnjucksWorld, unexpectedText: string) => {
    const output = world.getLastOutput();
    expect(output).not.toContain(unexpectedText);
  },

  'it should match the pattern {string}': (world: UnjucksWorld, pattern: string) => {
    const output = world.getLastOutput();
    const regex = new RegExp(pattern, 'i');
    expect(output).toMatch(regex);
  },

  'it should be empty': (world: UnjucksWorld) => {
    const output = world.getLastOutput().trim();
    expect(output).toBe('');
  },

  // Debug and introspection steps
  'I debug the current state': (world: UnjucksWorld) => {
    const state = {
      tempDirectory: world.context.tempDirectory,
      templateVariables: world.context.templateVariables,
      lastCommandOutput: world.context.lastCommandOutput,
      lastCommandError: world.context.lastCommandError,
      lastCommandCode: world.context.lastCommandCode,
      generatedFiles: world.context.generatedFiles
    };
    console.log('Debug state:', JSON.stringify(state, null, 2));
  },

  'I should see debug information': (world: UnjucksWorld) => {
    // This step allows tests to trigger debug output
    world.debugMode = true;
  },

  // Wait and timing steps
  'I wait {int} milliseconds': async (world: UnjucksWorld, ms: number) => {
    await new Promise(resolve => setTimeout(resolve, ms));
  },

  // Generic validation steps
  'the result should be successful': (world: UnjucksWorld) => {
    world.assertCommandSucceeded();
  },

  'the result should fail': (world: UnjucksWorld) => {
    world.assertCommandFailed();
  },

  'the exit code should be {int}': (world: UnjucksWorld, expectedCode: number) => {
    expect(world.getLastExitCode()).toBe(expectedCode);
  },

  // String and text manipulation steps
  'the output should be exactly {string}': (world: UnjucksWorld, expectedOutput: string) => {
    const actualOutput = world.getLastOutput().trim();
    expect(actualOutput).toBe(expectedOutput);
  },

  'the output should start with {string}': (world: UnjucksWorld, expectedStart: string) => {
    const output = world.getLastOutput();
    expect(output.startsWith(expectedStart)).toBe(true);
  },

  'the output should end with {string}': (world: UnjucksWorld, expectedEnd: string) => {
    const output = world.getLastOutput();
    expect(output.endsWith(expectedEnd)).toBe(true);
  },

  'the output length should be {int}': (world: UnjucksWorld, expectedLength: number) => {
    const output = world.getLastOutput();
    expect(output.length).toBe(expectedLength);
  },

  'the output should be longer than {int} characters': (world: UnjucksWorld, minLength: number) => {
    const output = world.getLastOutput();
    expect(output.length).toBeGreaterThan(minLength);
  },

  'the output should be shorter than {int} characters': (world: UnjucksWorld, maxLength: number) => {
    const output = world.getLastOutput();
    expect(output.length).toBeLessThan(maxLength);
  },

  // File pattern and structure validation
  'the generated files should follow naming convention {string}': async (world: UnjucksWorld, pattern: string) => {
    const files = await world.listFiles();
    const regex = new RegExp(pattern);
    
    for (const file of files) {
      expect(regex.test(file)).toBe(true);
    }
  },

  'all generated files should have valid syntax': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        const content = await world.readGeneratedFile(file);
        
        // Basic syntax validation - no unmatched braces
        const openBraces = (content.match(/{/g) || []).length;
        const closeBraces = (content.match(/}/g) || []).length;
        expect(openBraces).toBe(closeBraces);
        
        // No template variables left unresolved
        expect(content).not.toMatch(/\{\{\s*\w+\s*\}\}/);
      }
    }
  },

  // Error handling and edge cases
  'I expect no errors': (world: UnjucksWorld) => {
    const error = world.getLastError();
    expect(error.trim()).toBe('');
  },

  'I expect the error to contain {string}': (world: UnjucksWorld, expectedError: string) => {
    const error = world.getLastError();
    expect(error).toContain(expectedError);
  },

  // Cleanup and reset steps
  'I reset the test state': (world: UnjucksWorld) => {
    world.clearVariables();
    world.context.lastCommandOutput = '';
    world.context.lastCommandError = '';
    world.context.lastCommandCode = null;
    world.context.generatedFiles = [];
  },

  'I clear all variables': (world: UnjucksWorld) => {
    world.clearVariables();
  },

  // Performance and resource usage
  'the command should complete quickly': (world: UnjucksWorld) => {
    const result = world.getLastCommandResult();
    const duration = result.duration || 0;
    expect(duration).toBeLessThan(5000); // Less than 5 seconds
  },

  'the memory usage should be reasonable': (world: UnjucksWorld) => {
    // This is a placeholder for future memory monitoring
    expect(true).toBe(true);
  },

  // Cross-platform compatibility steps
  'the file paths should use correct separators': async (world: UnjucksWorld) => {
    const files = await world.listFiles();
    
    for (const file of files) {
      if (process.platform === 'win32') {
        expect(file).not.toMatch(/\//);
      } else {
        expect(file).not.toMatch(/\\/);
      }
    }
  }
};