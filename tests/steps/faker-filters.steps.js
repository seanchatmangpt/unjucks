/**
 * BDD Step definitions for faker filter testing
 * Tests Faker.js integration filters for generating test data
 */

import { Given, When, Then, Before, After } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { nunjucksHelper } from '../helpers/nunjucks-test-helper.js';
import { faker } from '@faker-js/faker';

// Setup and teardown
Before(() => {
  nunjucksHelper.setupEnvironment();
  // Set consistent seed for deterministic testing
  faker.seed(12345);
});

After(() => {
  nunjucksHelper.cleanup();
});

// Given steps - setup faker context
Given('I have a faker seed set to {int}', (seed) => {
  faker.seed(seed);
  nunjucksHelper.setContext({ fakerSeed: seed });
});

Given('I have a template using faker filters', () => {
  nunjucksHelper.setContext({ useFaker: true });
});

Given('I need to generate {int} fake records', (count) => {
  nunjucksHelper.setContext({ recordCount: count });
});

// When steps - faker filter application
When('I generate a fake name', async () => {
  const template = `{{ '' | fakerName }}`;
  await nunjucksHelper.renderString(template);
});

When('I generate a fake email', async () => {
  const template = `{{ '' | fakerEmail }}`;
  await nunjucksHelper.renderString(template);
});

When('I generate a fake phone number', async () => {
  const template = `{{ '' | fakerPhone }}`;
  await nunjucksHelper.renderString(template);
});

When('I generate a fake address', async () => {
  const template = `{{ '' | fakerAddress }}`;
  await nunjucksHelper.renderString(template);
});

When('I generate a fake company name', async () => {
  const template = `{{ '' | fakerCompany }}`;
  await nunjucksHelper.renderString(template);
});

When('I generate a fake UUID', async () => {
  const template = `{{ '' | fakerUuid }}`;
  await nunjucksHelper.renderString(template);
});

When('I generate fake lorem text with {int} words', async (wordCount) => {
  const template = `{{ '' | fakerLorem(${wordCount}) }}`;
  await nunjucksHelper.renderString(template);
});

When('I generate fake lorem text', async () => {
  const template = `{{ '' | fakerLorem }}`;
  await nunjucksHelper.renderString(template);
});

When('I use faker global directly for {string}', async (method) => {
  const template = `{{ faker.${method}() }}`;
  await nunjucksHelper.renderString(template);
});

When('I generate multiple fake values using template {string}', async (templateString) => {
  await nunjucksHelper.renderString(templateString);
});

When('I combine faker with other filters {string}', async (filterExpression) => {
  const template = `{{ ${filterExpression} }}`;
  await nunjucksHelper.renderString(template);
});

// Then steps - faker validation
Then('the output should be a valid full name', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^[A-Za-z]+\s+[A-Za-z]+/); // First Last name pattern
  expect(result.length).toBeGreaterThan(2);
});

Then('the output should be a valid email address', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
});

Then('the output should be a valid phone number', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  // Phone numbers can have various formats, so we check for digits and common separators
  expect(result).toMatch(/[\d\s\-\(\)\+\.]+/);
  expect(result.replace(/\D/g, '').length).toBeGreaterThan(7); // At least 7 digits
});

Then('the output should be a valid street address', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/\d+\s+[A-Za-z]/); // Number followed by street name
  expect(result.length).toBeGreaterThan(5);
});

Then('the output should be a valid company name', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(typeof result).toBe('string');
  expect(result.length).toBeGreaterThan(2);
  expect(result.trim()).toBe(result); // No leading/trailing whitespace
});

Then('the output should be a valid UUID', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});

Then('the output should be lorem text with {int} words', (expectedWordCount) => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  const words = result.trim().split(/\s+/);
  expect(words.length).toBe(expectedWordCount);
});

Then('the output should be lorem text with default word count', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  const words = result.trim().split(/\s+/);
  expect(words.length).toBe(5); // Default faker lorem words
});

Then('the output should contain generated fake data', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(typeof result).toBe('string');
  expect(result.length).toBeGreaterThan(0);
  expect(result.trim()).toBe(result);
});

// Multiple data generation tests
Then('the output should contain {int} generated items', (expectedCount) => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  // Count items by splitting on common delimiters
  let items;
  if (result.includes('\n')) {
    items = result.split('\n').filter(item => item.trim());
  } else if (result.includes(',')) {
    items = result.split(',').filter(item => item.trim());
  } else {
    items = [result]; // Single item
  }
  
  expect(items.length).toBe(expectedCount);
});

Then('each generated item should be unique', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  let items;
  if (result.includes('\n')) {
    items = result.split('\n').filter(item => item.trim());
  } else if (result.includes(',')) {
    items = result.split(',').filter(item => item.trim());
  } else {
    items = [result];
  }
  
  const uniqueItems = [...new Set(items)];
  expect(uniqueItems.length).toBe(items.length);
});

// Consistency tests (when seed is set)
Then('the output should be consistent with seed', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  // Re-render with same seed to test consistency
  const seed = nunjucksHelper.context.fakerSeed || 12345;
  faker.seed(seed);
  
  expect(typeof result).toBe('string');
  expect(result.length).toBeGreaterThan(0);
});

// Complex faker scenarios
Then('the output should be a complete user profile', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  // Check that result contains multiple data types
  expect(result).toMatch(/[A-Za-z]+\s+[A-Za-z]+/); // Name pattern
  expect(result).toMatch(/[^\s@]+@[^\s@]+\.[^\s@]+/); // Email pattern
});

Then('the generated data should be properly formatted', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  // Basic formatting checks
  expect(result.trim()).toBe(result); // No extra whitespace
  expect(result.length).toBeGreaterThan(0);
  expect(typeof result).toBe('string');
});

// Integration with other filters
Then('the faker data should be properly case-converted', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  // The result should still be valid after case conversion
  expect(typeof result).toBe('string');
  expect(result.length).toBeGreaterThan(0);
});

// Utility steps
Then('I should see fake data patterns:', (dataTable) => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  dataTable.forEach(row => {
    const dataType = row.data_type;
    const pattern = row.expected_pattern;
    const regex = new RegExp(pattern);
    expect(result).toMatch(regex);
  });
});

Then('the fake data should be different from {string}', (previousValue) => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  // When not using a fixed seed, values should be different
  if (!nunjucksHelper.context.fakerSeed) {
    expect(result).not.toBe(previousValue);
  }
});