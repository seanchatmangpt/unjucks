/**
 * BDD Step definitions for datetime filter testing
 * Tests Day.js integration filters for date formatting and manipulation
 */

import { Given, When, Then, Before, After } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { nunjucksHelper } from '../helpers/nunjucks-test-helper.js';
import dayjs from 'dayjs';

// Setup and teardown
Before(() => {
  nunjucksHelper.setupEnvironment();
});

After(() => {
  nunjucksHelper.cleanup();
});

// Given steps - setup datetime context
Given('I have a date {string}', (dateString) => {
  nunjucksHelper.setContext({ testDate: dateString });
});

Given('I have a current timestamp', () => {
  nunjucksHelper.setContext({ currentTime: new Date().toISOString() });
});

Given('I have the following date variables:', (dataTable) => {
  const context = {};
  dataTable.forEach(row => {
    context[row.variable] = row.date_value;
  });
  nunjucksHelper.setContext(context);
});

Given('I have a date in the past {int} days', (daysAgo) => {
  const pastDate = dayjs().subtract(daysAgo, 'day').toISOString();
  nunjucksHelper.setContext({ pastDate });
});

Given('I have a date in the future {int} days', (daysAhead) => {
  const futureDate = dayjs().add(daysAhead, 'day').toISOString();
  nunjucksHelper.setContext({ futureDate });
});

// When steps - datetime filter application
When('I format the date with {string} using dateFormat filter', async (format) => {
  const template = `{{ testDate | dateFormat("${format}") }}`;
  await nunjucksHelper.renderString(template);
});

When('I add {int} {string} to the date', async (amount, unit) => {
  const template = `{{ testDate | dateAdd(${amount}, "${unit}") }}`;
  await nunjucksHelper.renderString(template);
});

When('I subtract {int} {string} from the date', async (amount, unit) => {
  const template = `{{ testDate | dateSubtract(${amount}, "${unit}") }}`;
  await nunjucksHelper.renderString(template);
});

When('I get the relative time from now', async () => {
  const template = `{{ testDate | fromNow }}`;
  await nunjucksHelper.renderString(template);
});

When('I use the timestamp global function', async () => {
  const template = `{{ timestamp() }}`;
  await nunjucksHelper.renderString(template);
});

When('I use the now global function', async () => {
  const template = `{{ now() }}`;
  await nunjucksHelper.renderString(template);
});

When('I format current date with formatDate global', async () => {
  const template = `{{ formatDate() }}`;
  await nunjucksHelper.renderString(template);
});

When('I format a specific date {string} with format {string}', async (date, format) => {
  const template = `{{ formatDate("${date}", "${format}") }}`;
  await nunjucksHelper.renderString(template);
});

When('I chain datetime filters {string}', async (filterChain) => {
  const template = `{{ testDate | ${filterChain} }}`;
  await nunjucksHelper.renderString(template);
});

// Then steps - datetime assertions
Then('the output should be a valid date format {string}', (expectedFormat) => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  // Test that the result matches the expected format pattern
  switch (expectedFormat) {
    case 'YYYY-MM-DD':
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      break;
    case 'MM/DD/YYYY':
      expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      break;
    case 'DD-MM-YYYY HH:mm:ss':
      expect(result).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
      break;
    case 'YYYY-MM-DD HH:mm:ss':
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      break;
    default:
      expect(typeof result).toBe('string');
  }
});

Then('the output should be a valid ISO date', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

Then('the output should be a valid timestamp', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  expect(result).toMatch(/^\d{14}$/); // YYYYMMDDHHMMSS format
});

Then('the output should contain relative time words', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult().toLowerCase();
  const relativeWords = ['ago', 'in', 'second', 'minute', 'hour', 'day', 'week', 'month', 'year', 'now'];
  const containsRelativeWord = relativeWords.some(word => result.includes(word));
  expect(containsRelativeWord).toBeTruthy();
});

Then('the date should be {int} {string} later', (amount, unit) => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  // Parse the result and verify it's the expected amount later
  const resultDate = dayjs(result);
  const originalDate = dayjs(nunjucksHelper.context.testDate);
  const expectedDate = originalDate.add(amount, unit);
  
  expect(resultDate.format('YYYY-MM-DD')).toBe(expectedDate.format('YYYY-MM-DD'));
});

Then('the date should be {int} {string} earlier', (amount, unit) => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  // Parse the result and verify it's the expected amount earlier
  const resultDate = dayjs(result);
  const originalDate = dayjs(nunjucksHelper.context.testDate);
  const expectedDate = originalDate.subtract(amount, unit);
  
  expect(resultDate.format('YYYY-MM-DD')).toBe(expectedDate.format('YYYY-MM-DD'));
});

Then('the output should be today\'s date', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  const today = dayjs().format('YYYY-MM-DD');
  
  // Check if result contains today's date (could be with time)
  expect(result).toContain(today);
});

Then('the output should be a future date', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  const resultDate = dayjs(result);
  const now = dayjs();
  
  expect(resultDate.isAfter(now)).toBeTruthy();
});

Then('the output should be a past date', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  const resultDate = dayjs(result);
  const now = dayjs();
  
  expect(resultDate.isBefore(now)).toBeTruthy();
});

// Complex datetime scenarios
Then('the formatted date should match {string}', (expectedDate) => {
  nunjucksHelper.assertRendersSuccessfully();
  nunjucksHelper.assertEquals(expectedDate);
});

Then('the output should be between {string} and {string}', (startDate, endDate) => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  const resultDate = dayjs(result);
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  
  expect(resultDate.isAfter(start) || resultDate.isSame(start)).toBeTruthy();
  expect(resultDate.isBefore(end) || resultDate.isSame(end)).toBeTruthy();
});

// Utility steps for datetime testing
Then('I should see date components:', (dataTable) => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  dataTable.forEach(row => {
    const component = row.component;
    const expected = row.expected;
    expect(result).toContain(expected);
  });
});

Then('the date calculation should be accurate', () => {
  nunjucksHelper.assertRendersSuccessfully();
  const result = nunjucksHelper.getLastResult();
  
  // Verify the result is a valid date
  const parsedDate = dayjs(result);
  expect(parsedDate.isValid()).toBeTruthy();
});