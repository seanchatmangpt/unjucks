/**
 * BDD Feature: Basic Template Filters
 * Tests fundamental string manipulation and case conversion filters
 */

import { describe, test } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';

const feature = loadFeature('tests/features/template-filters/basic-filters.test.js', (f) => {
  f.scenario('Converting strings to different cases', (s) => {
    s.given('I have a variable "input" with value "hello_world"');
    s.when('I apply the "pascalCase" filter to "hello_world"');
    s.then('the output should be "HelloWorld"');
    s.and('the output should be in PascalCase');
  });

  f.scenario('Converting strings to camelCase', (s) => {
    s.given('I have a template string "{{ input | camelCase }}"');
    s.when('I render the template string "{{ \\"user_profile\\" | camelCase }}"');
    s.then('the output should be "userProfile"');
    s.and('the output should be in camelCase');
  });

  f.scenario('Converting strings to kebab-case', (s) => {
    s.given('I have a template string "{{ input | kebabCase }}"');
    s.when('I render the template string "{{ \\"UserProfile\\" | kebabCase }}"');
    s.then('the output should be "user-profile"');
    s.and('the output should be in kebab-case');
  });

  f.scenario('Converting strings to snake_case', (s) => {
    s.given('I have a template string "{{ input | snakeCase }}"');
    s.when('I render the template string "{{ \\"UserProfile\\" | snakeCase }}"');
    s.then('the output should be "user_profile"');
    s.and('the output should be in snake_case');
  });

  f.scenario('Converting strings to CONSTANT_CASE', (s) => {
    s.given('I have a template string "{{ input | constantCase }}"');
    s.when('I render the template string "{{ \\"user-profile\\" | constantCase }}"');
    s.then('the output should be "USER_PROFILE"');
    s.and('the output should be in CONSTANT_CASE');
  });

  f.scenario('Pluralizing and singularizing words', (s) => {
    s.given('I have a template string "{{ input | pluralize }}"');
    s.when('I render the template string "{{ \\"user\\" | pluralize }}"');
    s.then('the output should be "users"');
    s.and('the output should be pluralized');
  });

  f.scenario('Creating class names with classify filter', (s) => {
    s.given('I have a template string "{{ input | classify }}"');
    s.when('I render the template string "{{ \\"user_posts\\" | classify }}"');
    s.then('the output should be "UserPost"');
    s.and('the output should be a valid class name');
  });

  f.scenario('Creating table names with tableize filter', (s) => {
    s.given('I have a template string "{{ input | tableize }}"');
    s.when('I render the template string "{{ \\"UserPost\\" | tableize }}"');
    s.then('the output should be "user_posts"');
    s.and('the output should be a valid table name');
  });

  f.scenario('Chaining multiple filters', (s) => {
    s.given('I have a template string "{{ input | camelCase | pluralize }}"');
    s.when('I apply multiple filters "camelCase | pluralize" to "user_profile"');
    s.then('the output should be "userProfiles"');
    s.and('the output should be in camelCase');
    s.and('the output should be pluralized');
  });

  f.scenario('String truncation with truncate filter', (s) => {
    s.given('I have a template string "{{ input | truncate(10) }}"');
    s.when('I render the template string "{{ \\"This is a very long string\\" | truncate(10) }}"');
    s.then('the output should contain "..."');
    s.and('the output should be truncated');
    s.and('the output should have length 10');
  });
});

describeFeature(feature, ({ given, when, then, and }) => {
  // Step definitions are imported from the steps files
});