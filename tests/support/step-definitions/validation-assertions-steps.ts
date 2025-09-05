import { Given, When, Then } from '@cucumber/cucumber';
import { UnjucksWorld } from '../world';
import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Validation and Assertions Steps Library
 * Comprehensive step definitions for content matching, structure validation,
 * error scenarios, output validation, and advanced assertion patterns
 */

// Content validation setup
Given('I expect the output to match pattern {string}', function (this: UnjucksWorld, pattern: string) {
  this.context.expectedPatterns = this.context.expectedPatterns || [];
  this.context.expectedPatterns.push(pattern);
});

Given('I expect the file structure to match:', function (this: UnjucksWorld, expectedStructure: string) {
  this.context.expectedStructure = expectedStructure.split('\n').map(line => line.trim()).filter(Boolean);
});

Given('I have validation rules:', function (this: UnjucksWorld, rulesTable: any) {
  const rules = rulesTable.hashes();
  this.context.validationRules = rules.map((rule: any) => ({
    type: rule.type,
    pattern: rule.pattern,
    required: rule.required === 'true',
    message: rule.message
  }));
});

// Content assertions
Then('the content should match exactly:', function (this: UnjucksWorld, expectedContent: string) {
  const result = this.getLastCommandResult();
  const actualContent = result.stdout.trim();
  const expected = expectedContent.trim();
  
  assert.strictEqual(actualContent, expected, 
    `Content should match exactly.\nExpected:\n${expected}\nActual:\n${actualContent}`);
});

Then('the content should contain all of:', function (this: UnjucksWorld, expectedTable: any) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  const expectedItems = expectedTable.hashes();
  
  for (const item of expectedItems) {
    const expectedText = Object.values(item)[0] as string;
    assert.ok(output.includes(expectedText), 
      `Output should contain "${expectedText}". Actual output: ${output}`);
  }
});

Then('the content should not contain any of:', function (this: UnjucksWorld, forbiddenTable: any) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  const forbiddenItems = forbiddenTable.hashes();
  
  for (const item of forbiddenItems) {
    const forbiddenText = Object.values(item)[0] as string;
    assert.ok(!output.includes(forbiddenText), 
      `Output should not contain "${forbiddenText}". Actual output: ${output}`);
  }
});

Then('the content should match the pattern {string}', function (this: UnjucksWorld, pattern: string) {
  const result = this.getLastCommandResult();
  const output = result.stdout;
  const regex = new RegExp(pattern, 'm');
  
  assert.ok(regex.test(output), 
    `Output should match pattern "${pattern}". Actual output: ${output}`);
});

Then('the content should match all patterns:', function (this: UnjucksWorld, patternsTable: any) {
  const result = this.getLastCommandResult();
  const output = result.stdout;
  const patterns = patternsTable.hashes();
  
  for (const patternRow of patterns) {
    const pattern = Object.values(patternRow)[0] as string;
    const regex = new RegExp(pattern, 'm');
    assert.ok(regex.test(output), 
      `Output should match pattern "${pattern}". Actual output: ${output}`);
  }
});

// File content validation
Then('the file {string} should contain exactly:', async function (this: UnjucksWorld, filePath: string, expectedContent: string) {
  const actualContent = await this.helper.readFile(filePath);
  const expected = expectedContent.trim();
  const actual = actualContent.trim();
  
  assert.strictEqual(actual, expected, 
    `File ${filePath} should contain exactly:\n${expected}\nBut contains:\n${actual}`);
});

Then('the file {string} should match pattern {string}', async function (this: UnjucksWorld, filePath: string, pattern: string) {
  const content = await this.helper.readFile(filePath);
  const regex = new RegExp(pattern, 'm');
  
  assert.ok(regex.test(content), 
    `File ${filePath} should match pattern "${pattern}". File content: ${content}`);
});

Then('the file {string} should contain lines:', async function (this: UnjucksWorld, filePath: string, linesTable: any) {
  const content = await this.helper.readFile(filePath);
  const lines = content.split('\n');
  const expectedLines = linesTable.hashes();
  
  for (const lineRow of expectedLines) {
    const expectedLine = Object.values(lineRow)[0] as string;
    const lineExists = lines.some(line => line.trim() === expectedLine.trim());
    assert.ok(lineExists, 
      `File ${filePath} should contain line "${expectedLine}". File content: ${content}`);
  }
});

Then('the file {string} should not contain lines:', async function (this: UnjucksWorld, filePath: string, linesTable: any) {
  const content = await this.helper.readFile(filePath);
  const lines = content.split('\n');
  const forbiddenLines = linesTable.hashes();
  
  for (const lineRow of forbiddenLines) {
    const forbiddenLine = Object.values(lineRow)[0] as string;
    const lineExists = lines.some(line => line.trim() === forbiddenLine.trim());
    assert.ok(!lineExists, 
      `File ${filePath} should not contain line "${forbiddenLine}". File content: ${content}`);
  }
});

// Structure validation
Then('the file structure should match:', async function (this: UnjucksWorld, expectedStructure: string) {
  const expectedPaths = expectedStructure.split('\n').map(line => line.trim()).filter(Boolean);
  
  for (const expectedPath of expectedPaths) {
    const fullPath = path.join(this.context.tempDirectory!, expectedPath);
    try {
      await fs.access(fullPath);
    } catch (error) {
      throw new Error(`Expected path "${expectedPath}" should exist but was not found`);
    }
  }
});

Then('the directory structure should contain:', async function (this: UnjucksWorld, structureTable: any) {
  const expectedItems = structureTable.hashes();
  
  for (const item of expectedItems) {
    const { path: itemPath, type } = item;
    const fullPath = path.join(this.context.tempDirectory!, itemPath);
    
    try {
      const stats = await fs.stat(fullPath);
      if (type === 'file' && !stats.isFile()) {
        throw new Error(`"${itemPath}" should be a file but is not`);
      }
      if (type === 'directory' && !stats.isDirectory()) {
        throw new Error(`"${itemPath}" should be a directory but is not`);
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Expected ${type} "${itemPath}" should exist but was not found`);
      }
      throw error;
    }
  }
});

Then('the directory structure should not contain:', async function (this: UnjucksWorld, structureTable: any) {
  const forbiddenItems = structureTable.hashes();
  
  for (const item of forbiddenItems) {
    const { path: itemPath } = item;
    const fullPath = path.join(this.context.tempDirectory!, itemPath);
    
    try {
      await fs.access(fullPath);
      throw new Error(`Path "${itemPath}" should not exist but was found`);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
      // ENOENT is expected - the path should not exist
    }
  }
});

// Output format validation
Then('the output should be valid {string}', function (this: UnjucksWorld, format: string) {
  const result = this.getLastCommandResult();
  const output = result.stdout;
  
  switch (format.toLowerCase()) {
    case 'json':
      try {
        const parsed = JSON.parse(output);
        this.context.parsedOutput = parsed;
      } catch (error) {
        throw new Error(`Output is not valid JSON: ${output}`);
      }
      break;
      
    case 'yaml':
    case 'yml':
      try {
        // Simple YAML validation - in real implementation would use a YAML parser
        if (!output.includes(':') && !output.includes('-')) {
          throw new Error(`Output does not appear to be valid YAML: ${output}`);
        }
      } catch (error) {
        throw new Error(`Output is not valid YAML: ${output}`);
      }
      break;
      
    case 'xml':
      if (!output.includes('<') || !output.includes('>')) {
        throw new Error(`Output is not valid XML: ${output}`);
      }
      break;
      
    default:
      throw new Error(`Unsupported format validation: ${format}`);
  }
});

Then('the {string} should have the following properties:', function (this: UnjucksWorld, objectType: string, propertiesTable: any) {
  const parsed = this.context.parsedOutput;
  if (!parsed) {
    throw new Error('No parsed output available. Ensure output validation was run first.');
  }
  
  const expectedProperties = propertiesTable.hashes();
  
  for (const prop of expectedProperties) {
    const { property, value, type } = prop;
    
    assert.ok(parsed.hasOwnProperty(property), 
      `${objectType} should have property "${property}"`);
    
    if (value) {
      assert.strictEqual(String(parsed[property]), value, 
        `Property "${property}" should have value "${value}"`);
    }
    
    if (type) {
      const actualType = typeof parsed[property];
      assert.strictEqual(actualType, type, 
        `Property "${property}" should be of type "${type}"`);
    }
  }
});

// Error validation
Then('the error should be of type {string}', function (this: UnjucksWorld, expectedErrorType: string) {
  const result = this.getLastCommandResult();
  assert.notStrictEqual(result.exitCode, 0, 'Command should have failed');
  
  const errorOutput = result.stderr || result.stdout;
  assert.ok(errorOutput.toLowerCase().includes(expectedErrorType.toLowerCase()), 
    `Error should be of type "${expectedErrorType}". Actual error: ${errorOutput}`);
});

Then('the error message should contain:', function (this: UnjucksWorld, expectedTable: any) {
  const result = this.getLastCommandResult();
  const errorOutput = result.stderr || result.stdout;
  const expectedTexts = expectedTable.hashes();
  
  for (const textRow of expectedTexts) {
    const expectedText = Object.values(textRow)[0] as string;
    assert.ok(errorOutput.includes(expectedText), 
      `Error message should contain "${expectedText}". Actual error: ${errorOutput}`);
  }
});

Then('the error should provide suggestions:', function (this: UnjucksWorld, suggestionsTable: any) {
  const result = this.getLastCommandResult();
  const errorOutput = result.stderr || result.stdout;
  const expectedSuggestions = suggestionsTable.hashes();
  
  for (const suggestionRow of expectedSuggestions) {
    const suggestion = Object.values(suggestionRow)[0] as string;
    assert.ok(errorOutput.includes(suggestion), 
      `Error should suggest "${suggestion}". Actual error: ${errorOutput}`);
  }
});

// Validation rules application
When('I validate the output against the rules', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const output = result.stdout + result.stderr;
  const rules = this.context.validationRules || [];
  
  this.context.validationResults = [];
  
  for (const rule of rules) {
    const validationResult = {
      rule: rule,
      passed: false,
      message: ''
    };
    
    switch (rule.type) {
      case 'contains':
        validationResult.passed = output.includes(rule.pattern);
        validationResult.message = validationResult.passed ? 
          `Output contains required pattern "${rule.pattern}"` :
          `Output missing required pattern "${rule.pattern}"`;
        break;
        
      case 'not_contains':
        validationResult.passed = !output.includes(rule.pattern);
        validationResult.message = validationResult.passed ?
          `Output correctly excludes pattern "${rule.pattern}"` :
          `Output contains forbidden pattern "${rule.pattern}"`;
        break;
        
      case 'matches':
        const regex = new RegExp(rule.pattern);
        validationResult.passed = regex.test(output);
        validationResult.message = validationResult.passed ?
          `Output matches pattern "${rule.pattern}"` :
          `Output does not match pattern "${rule.pattern}"`;
        break;
        
      default:
        validationResult.message = `Unknown validation rule type: ${rule.type}`;
    }
    
    this.context.validationResults.push(validationResult);
  }
});

Then('all validation rules should pass', function (this: UnjucksWorld) {
  const results = this.context.validationResults || [];
  const failedRules = results.filter((r: any) => !r.passed);
  
  if (failedRules.length > 0) {
    const failureMessages = failedRules.map((r: any) => 
      `- ${r.rule.type}: ${r.message}`
    ).join('\n');
    throw new Error(`Validation failed:\n${failureMessages}`);
  }
});

Then('the validation rule {string} should pass', function (this: UnjucksWorld, ruleName: string) {
  const results = this.context.validationResults || [];
  const rule = results.find((r: any) => r.rule.pattern === ruleName || r.rule.message === ruleName);
  
  if (!rule) {
    throw new Error(`Validation rule "${ruleName}" not found`);
  }
  
  if (!rule.passed) {
    throw new Error(`Validation rule "${ruleName}" failed: ${rule.message}`);
  }
});

Then('the validation should report {int} failures', function (this: UnjucksWorld, expectedFailures: number) {
  const results = this.context.validationResults || [];
  const actualFailures = results.filter((r: any) => !r.passed).length;
  
  assert.strictEqual(actualFailures, expectedFailures, 
    `Expected ${expectedFailures} validation failures, got ${actualFailures}`);
});

// Advanced content validation
Then('the output lines should be sorted alphabetically', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const lines = result.stdout.split('\n').filter(line => line.trim());
  const sortedLines = [...lines].sort();
  
  assert.deepStrictEqual(lines, sortedLines, 'Output lines should be sorted alphabetically');
});

Then('the output should have consistent indentation', function (this: UnjucksWorld) {
  const result = this.getLastCommandResult();
  const lines = result.stdout.split('\n');
  
  // Check for consistent indentation (either all spaces or all tabs)
  const hasSpaces = lines.some(line => line.match(/^ +/));
  const hasTabs = lines.some(line => line.match(/^\t+/));
  
  assert.ok(!(hasSpaces && hasTabs), 'Indentation should be consistent (either spaces or tabs, not mixed)');
});

Then('each line should start with {string}', function (this: UnjucksWorld, prefix: string) {
  const result = this.getLastCommandResult();
  const lines = result.stdout.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    assert.ok(line.startsWith(prefix), 
      `Line "${line}" should start with "${prefix}"`);
  }
});

Then('the output should contain exactly {int} occurrences of {string}', function (this: UnjucksWorld, expectedCount: number, searchText: string) {
  const result = this.getLastCommandResult();
  const output = result.stdout;
  const matches = output.match(new RegExp(searchText, 'g')) || [];
  
  assert.strictEqual(matches.length, expectedCount, 
    `Output should contain exactly ${expectedCount} occurrences of "${searchText}", found ${matches.length}`);
});

// Performance validation
Then('the output should be generated within {int}ms', function (this: UnjucksWorld, maxDuration: number) {
  const result = this.getLastCommandResult();
  const duration = result.duration || 0;
  
  assert.ok(duration <= maxDuration, 
    `Output generation took ${duration}ms, should be within ${maxDuration}ms`);
});

Then('the output size should be less than {int} bytes', function (this: UnjucksWorld, maxSize: number) {
  const result = this.getLastCommandResult();
  const outputSize = Buffer.byteLength(result.stdout, 'utf8');
  
  assert.ok(outputSize < maxSize, 
    `Output size is ${outputSize} bytes, should be less than ${maxSize} bytes`);
});

// Factory function for creating validation and assertion steps
export function createValidationAssertionSteps(context?: any) {
  return {
    expectOutputPattern: Given,
    expectFileStructure: Given,
    validationRules: Given,
    contentShouldMatchExactly: Then,
    contentShouldContainAll: Then,
    contentShouldNotContainAny: Then,
    contentShouldMatchPattern: Then,
    contentShouldMatchAllPatterns: Then,
    fileShouldContainExactly: Then,
    fileShouldMatchPattern: Then,
    fileShouldContainLines: Then,
    fileShouldNotContainLines: Then,
    fileStructureShouldMatch: Then,
    directoryStructureShouldContain: Then,
    directoryStructureShouldNotContain: Then,
    outputShouldBeValidFormat: Then,
    objectShouldHaveProperties: Then,
    errorShouldBeOfType: Then,
    errorMessageShouldContain: Then,
    errorShouldProvideSuggestions: Then,
    validateOutputAgainstRules: When,
    allValidationRulesShouldPass: Then,
    validationRuleShouldPass: Then,
    validationShouldReportFailures: Then,
    outputLinesShouldBeSorted: Then,
    outputShouldHaveConsistentIndentation: Then,
    eachLineShouldStartWith: Then,
    outputShouldContainExactOccurrences: Then,
    outputGeneratedWithinTime: Then,
    outputSizeShouldBeLessThan: Then
  };
}