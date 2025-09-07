/**
 * BDD Feature: Faker Filter Testing
 * Tests Faker.js integration for generating realistic test data
 */

import { describe, test } from 'vitest';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';

const feature = loadFeature('tests/features/faker-filters/data-generation.test.js', (f) => {
  f.scenario('Generating fake names', (s) => {
    s.given('I have a faker seed set to 12345');
    s.when('I generate a fake name');
    s.then('the output should be a valid full name');
    s.and('the output should be consistent with seed');
  });

  f.scenario('Generating fake email addresses', (s) => {
    s.given('I have a template using faker filters');
    s.when('I generate a fake email');
    s.then('the output should be a valid email address');
  });

  f.scenario('Generating fake phone numbers', (s) => {
    s.given('I have a template using faker filters');
    s.when('I generate a fake phone number');
    s.then('the output should be a valid phone number');
  });

  f.scenario('Generating fake addresses', (s) => {
    s.given('I have a template using faker filters');
    s.when('I generate a fake address');
    s.then('the output should be a valid street address');
  });

  f.scenario('Generating fake company names', (s) => {
    s.given('I have a template using faker filters');
    s.when('I generate a fake company name');
    s.then('the output should be a valid company name');
  });

  f.scenario('Generating fake UUIDs', (s) => {
    s.given('I have a template using faker filters');
    s.when('I generate a fake UUID');
    s.then('the output should be a valid UUID');
  });

  f.scenario('Generating lorem text with specific word count', (s) => {
    s.given('I have a template using faker filters');
    s.when('I generate fake lorem text with 3 words');
    s.then('the output should be lorem text with 3 words');
  });

  f.scenario('Generating lorem text with default word count', (s) => {
    s.given('I have a template using faker filters');
    s.when('I generate fake lorem text');
    s.then('the output should be lorem text with default word count');
  });

  f.scenario('Using faker global directly', (s) => {
    s.given('I have a template using faker filters');
    s.when('I use faker global directly for "person.firstName"');
    s.then('the output should contain generated fake data');
  });

  f.scenario('Generating multiple fake records', (s) => {
    s.given('I need to generate 3 fake records');
    s.when('I generate multiple fake values using template "{% for i in range(3) %}{{ \\'\\' | fakerName }} - {{ \\'\\' | fakerEmail }}\\n{% endfor %}"');
    s.then('the output should contain 3 generated items');
    s.and('each generated item should be unique');
  });

  f.scenario('Combining faker with other filters', (s) => {
    s.given('I have a template using faker filters');
    s.when('I combine faker with other filters "\\'\\' | fakerName | upperCase"');
    s.then('the faker data should be properly case-converted');
  });

  f.scenario('Creating complete user profile with faker', (s) => {
    s.given('I have a template using faker filters');
    s.when('I generate multiple fake values using template "Name: {{ \\'\\' | fakerName }}\\nEmail: {{ \\'\\' | fakerEmail }}\\nCompany: {{ \\'\\' | fakerCompany }}"');
    s.then('the output should be a complete user profile');
    s.and('the generated data should be properly formatted');
  });
});

describeFeature(feature, ({ given, when, then, and }) => {
  // Step definitions are imported from the steps files
});