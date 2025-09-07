/**
 * BDD Feature: DateTime Filter Testing
 * Tests Day.js integration for date formatting and manipulation
 */

import { describe, test } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';

const feature = loadFeature('tests/features/datetime-filters/date-formatting.test.js', (f) => {
  f.scenario('Formatting dates with dateFormat filter', (s) => {
    s.given('I have a date "2024-01-15T10:30:00Z"');
    s.when('I format the date with "YYYY-MM-DD" using dateFormat filter');
    s.then('the output should be "2024-01-15"');
    s.and('the output should be a valid date format "YYYY-MM-DD"');
  });

  f.scenario('Adding days to a date', (s) => {
    s.given('I have a date "2024-01-15T10:30:00Z"');
    s.when('I add 7 "day" to the date');
    s.then('the output should be a valid ISO date');
    s.and('the date should be 7 "day" later');
  });

  f.scenario('Subtracting time from a date', (s) => {
    s.given('I have a date "2024-01-15T10:30:00Z"');
    s.when('I subtract 3 "month" from the date');
    s.then('the output should be a valid ISO date');
    s.and('the date should be 3 "month" earlier');
  });

  f.scenario('Getting relative time with fromNow filter', (s) => {
    s.given('I have a date in the past 7 days');
    s.when('I get the relative time from now');
    s.then('the output should contain relative time words');
  });

  f.scenario('Using global timestamp function', (s) => {
    s.given('I have a template using timestamp global');
    s.when('I use the timestamp global function');
    s.then('the output should be a valid timestamp');
  });

  f.scenario('Using global now function for database timestamps', (s) => {
    s.given('I have a template for database migration');
    s.when('I use the now global function');
    s.then('the output should be a valid date format "YYYY-MM-DD HH:mm:ss"');
  });

  f.scenario('Chaining datetime operations', (s) => {
    s.given('I have a date "2024-01-01T00:00:00Z"');
    s.when('I chain datetime filters "dateAdd(1, \\"month\\") | dateFormat(\\"MM/DD/YYYY\\")"');
    s.then('the output should be "02/01/2024"');
    s.and('the output should be a valid date format "MM/DD/YYYY"');
  });

  f.scenario('Complex date calculations', (s) => {
    s.given('I have a date "2024-01-15T10:30:00Z"');
    s.when('I render the template string "{{ testDate | dateAdd(30, \\"day\\") | dateSubtract(7, \\"day\\") | dateFormat(\\"YYYY-MM-DD\\") }}"');
    s.then('the output should be "2024-02-07"');
    s.and('the date calculation should be accurate');
  });
});

describeFeature(feature, ({ given, when, then, and }) => {
  // Step definitions are imported from the steps files
});