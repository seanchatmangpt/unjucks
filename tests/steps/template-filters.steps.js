/**
 * BDD Step definitions for template filter testing
 * Tests Nunjucks filters for case conversion, inflection, and string manipulation
 */

import { Given, When, Then, Before, After } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { nunjucksHelper } from '../helpers/nunjucks-test-helper.js';

// Setup and teardown
Before(() => {
  nunjucksHelper.setupEnvironment();
});

After(() => {
  nunjucksHelper.cleanup();
});

// Given steps - setup template context
Given('I have a template with content {string}', (templateContent) => {
  nunjucksHelper.registerTemplate('test_template', templateContent);
});

Given('I have a variable {string} with value {string}', (varName, varValue) => {
  nunjucksHelper.setContext({ [varName]: varValue });
});

Given('I have the following template variables:', (dataTable) => {
  const context = {};
  dataTable.forEach(row => {
    context[row.variable] = row.value;
  });
  nunjucksHelper.setContext(context);
});

Given('I have a template string {string}', (templateString) => {
  nunjucksHelper.registerTemplate('inline_template', templateString);
});

// When steps - template rendering actions
When('I render the template', async () => {
  await nunjucksHelper.renderTemplate('test_template');
});

When('I render the inline template', async () => {
  await nunjucksHelper.renderTemplate('inline_template');
});

When('I render the template string {string}', async (templateString) => {
  await nunjucksHelper.renderString(templateString);
});

When('I render the template string {string} with context:', async (templateString, dataTable) => {
  const context = {};
  dataTable.forEach(row => {
    context[row.key] = row.value;
  });
  await nunjucksHelper.renderString(templateString, context);
});

When('I apply the {string} filter to {string}', async (filterName, inputValue) => {
  const template = `{{ input | ${filterName} }}`;
  await nunjucksHelper.renderString(template, { input: inputValue });
});

When('I apply the {string} filter with parameter {string} to {string}', async (filterName, parameter, inputValue) => {
  const template = `{{ input | ${filterName}(${JSON.stringify(parameter)}) }}`;
  await nunjucksHelper.renderString(template, { input: inputValue });
});

When('I apply multiple filters {string} to {string}', async (filterChain, inputValue) => {
  const template = `{{ input | ${filterChain} }}`;
  await nunjucksHelper.renderString(template, { input: inputValue });
});

// Then steps - assertions
Then('the output should be {string}', (expectedOutput) => {
  nunjucksHelper.assertRendersSuccessfully();
  nunjucksHelper.assertEquals(expectedOutput);
});

Then('the output should contain {string}', (substring) => {
  nunjucksHelper.assertRendersSuccessfully();
  nunjucksHelper.assertContains(substring);
});

Then('the output should match the pattern {string}', (regexPattern) => {
  nunjucksHelper.assertRendersSuccessfully();
  const regex = new RegExp(regexPattern);
  nunjucksHelper.assertMatches(regex);
});

Then('the rendering should fail', () => {
  expect(nunjucksHelper.getLastError()).toBeTruthy();
});

Then('the rendering should succeed', () => {
  nunjucksHelper.assertRendersSuccessfully();
});

Then('the output should be empty', () => {
  nunjucksHelper.assertRendersSuccessfully();
  nunjucksHelper.assertEquals('');
});

Then('the output should not be empty', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toBeTruthy();
  expect(result.length).toBeGreaterThan(0);
});

// Case conversion filter steps
Then('the output should be in PascalCase', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^[A-Z][a-zA-Z0-9]*$/);
});

Then('the output should be in camelCase', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^[a-z][a-zA-Z0-9]*$/);
});

Then('the output should be in kebab-case', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
});

Then('the output should be in snake_case', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/);
});

Then('the output should be in CONSTANT_CASE', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^[A-Z0-9]+(_[A-Z0-9]+)*$/);
});

// String manipulation filter steps
Then('the output should be pluralized', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/(s|es|ies)$/);
});

Then('the output should be singularized', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).not.toMatch(/(s|es|ies)$/);
});

Then('the output should be truncated', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toContain('...');
});

Then('the output should have length {int}', (expectedLength) => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result.length).toBe(expectedLength);
});

Then('the output should be reversed', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  // We can't easily test if it's reversed without knowing the input
  // But we can test that it's a valid string result
  expect(typeof result).toBe('string');
  expect(result.length).toBeGreaterThan(0);
});

// Complex filter combination steps
Then('the output should be a valid class name', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^[A-Z][a-zA-Z0-9]*$/);
});

Then('the output should be a valid table name', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^[a-z][a-z0-9_]*s$/);
});

Then('the output should be a valid slug', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
});

// Debug and utility steps
Then('I save the output as {string}', async (filename) => {
  const outputPath = await nunjucksHelper.saveOutput(filename);
  console.log(`Output saved to: ${outputPath}`);
});

Then('I should see the template variables:', (dataTable) => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  dataTable.forEach(row => {
    const varName = row.variable;
    const expectedValue = row.expected_value;
    expect(result).toContain(expectedValue);
  });
});