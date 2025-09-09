/**
 * Comprehensive Filter System Test
 * Tests all filter categories for proper functionality
 */

import { describe, test, expect } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';

describe('Comprehensive Filter System Tests', () => {
  let env;

  beforeEach(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('String Manipulation Filters', () => {
    test('basic case conversion works', () => {
      expect(env.renderString('{{ "hello world" | pascalCase }}')).toBe('HelloWorld');
      expect(env.renderString('{{ "hello world" | camelCase }}')).toBe('helloWorld');
      expect(env.renderString('{{ "hello world" | kebabCase }}')).toBe('hello-world');
      expect(env.renderString('{{ "hello world" | snakeCase }}')).toBe('hello_world');
    });

    test('pluralization works correctly', () => {
      expect(env.renderString('{{ "cat" | pluralize }}')).toBe('cats');
      expect(env.renderString('{{ "bus" | pluralize }}')).toBe('buses');
      expect(env.renderString('{{ "city" | pluralize }}')).toBe('cities');
      expect(env.renderString('{{ "knife" | pluralize }}')).toBe('knives');
      expect(env.renderString('{{ "person" | pluralize }}')).toBe('people');
    });

    test('singularization works correctly', () => {
      expect(env.renderString('{{ "cats" | singular }}')).toBe('cat');
      expect(env.renderString('{{ "buses" | singular }}')).toBe('bus');
      expect(env.renderString('{{ "cities" | singular }}')).toBe('city');
      expect(env.renderString('{{ "knives" | singular }}')).toBe('knife');
      expect(env.renderString('{{ "people" | singular }}')).toBe('person');
    });

    test('title case with exact preservations', () => {
      expect(env.renderString('{{ "audiotech" | titleCase }}')).toBe('AudioTech');
      expect(env.renderString('{{ "techcorp solutions" | titleCase }}')).toBe('TechCorp Solutions');
      expect(env.renderString('{{ "schema.org" | titleCase }}')).toBe('Schema.org');
      expect(env.renderString('{{ "seo specialist" | titleCase }}')).toBe('SEO Specialist');
    });
  });

  describe('Date and Time Filters', () => {
    test('basic date formatting works', () => {
      const testDate = new Date('2025-09-08T14:30:22Z');
      const template = '{{ date | formatDate("YYYY-MM-DD") }}';
      const result = env.renderString(template, { date: testDate });
      expect(result).toBe('2025-09-08');
    });

    test('legal date formatting works', () => {
      const testDate = new Date('2025-09-08T14:30:22Z');
      const template = '{{ date | formatLegalDate("US", "contract") }}';
      const result = env.renderString(template, { date: testDate });
      expect(result).toMatch(/September 8th, 2025/);
    });

    test('compliance date formatting works', () => {
      const testDate = new Date('2025-09-08T14:30:22Z');
      const template = '{{ date | formatComplianceDate("SOX") }}';
      const result = env.renderString(template, { date: testDate });
      expect(result).toBe('2025-09-08');
    });
  });

  describe('Faker Filters', () => {
    test('faker name generation works', () => {
      const result = env.renderString('{{ "" | fakeName }}');
      expect(result).toMatch(/\w+ \w+/); // Should be "Name Name" format
      expect(result).not.toBe('');
    });

    test('faker email generation works', () => {
      const result = env.renderString('{{ "" | fakeEmail }}');
      expect(result).toMatch(/\w+@\w+\.\w+/); // Should be email format
    });

    test('faker uuid generation works', () => {
      const result = env.renderString('{{ "" | fakeUuid }}');
      expect(result).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    });
  });

  describe('Utility Filters', () => {
    test('JSON dump filter works without escaping', () => {
      const data = { name: 'test', value: 123, nested: { key: 'value' } };
      const template = '{{ data | dump }}';
      const result = env.renderString(template, { data });
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe('test');
      expect(parsed.value).toBe(123);
      expect(parsed.nested.key).toBe('value');
    });

    test('number filter works', () => {
      expect(env.renderString('{{ "123.456" | number(2) }}')).toBe('123.46');
      expect(env.renderString('{{ null | number }}')).toBe('0');
      expect(env.renderString('{{ "" | number }}')).toBe('0');
    });

    test('escape filter works', () => {
      const dangerous = '<script>alert("xss")</script>';
      const template = '{{ input | escape }}';
      const result = env.renderString(template, { input: dangerous });
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('Advanced String Utilities', () => {
    test('truncate filter works', () => {
      const longText = 'This is a very long text that should be truncated';
      const template = '{{ text | truncate(20) }}';
      const result = env.renderString(template, { text: longText });
      expect(result.length).toBeLessThanOrEqual(20);
      expect(result).toContain('...');
    });

    test('wrap filter works', () => {
      const longLine = 'This is a very long line that should be wrapped at a certain width';
      const template = '{{ text | wrap(20) }}';
      const result = env.renderString(template, { text: longLine });
      expect(result).toContain('\n');
    });

    test('humanize filter works', () => {
      expect(env.renderString('{{ "user_name" | humanize }}')).toBe('User name');
      expect(env.renderString('{{ "firstName" | humanize }}')).toBe('First name');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('filters handle null values gracefully', () => {
      expect(env.renderString('{{ null | pascalCase }}')).toBe('');
      expect(env.renderString('{{ null | formatDate }}')).toBe('');
      expect(env.renderString('{{ null | pluralize }}')).toBe('');
    });

    test('filters handle undefined values gracefully', () => {
      expect(env.renderString('{{ undefined | camelCase }}')).toBe('');
      expect(env.renderString('{{ undefined | singular }}')).toBe('');
    });

    test('filters handle non-string inputs', () => {
      expect(env.renderString('{{ 123 | pascalCase }}')).toBe('123');
      expect(env.renderString('{{ true | kebabCase }}')).toBe('true');
    });
  });
});