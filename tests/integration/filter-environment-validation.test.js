/**
 * Filter Environment Validation Tests
 * Validates Nunjucks environment setup and filter registration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';
import nunjucks from 'nunjucks';

describe('Filter Environment Validation', () => {
  let nunjucksEnv;

  beforeEach(() => {
    nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader('_templates'),
      {
        autoescape: false,
        throwOnUndefined: false
      }
    );
    
    addCommonFilters(nunjucksEnv);
  });

  describe('Filter Registration Validation', () => {
    it('should register all basic case conversion filters', () => {
      const basicFilters = [
        'pascalCase', 'PascalCase',
        'camelCase',
        'kebabCase', 'kebab-case',
        'snakeCase', 'snake_case',
        'constantCase', 'CONSTANT_CASE',
        'capitalize',
        'lower', 'lowerCase',
        'upper', 'upperCase'
      ];

      basicFilters.forEach(filterName => {
        expect(nunjucksEnv.filters[filterName]).toBeDefined();
        expect(typeof nunjucksEnv.filters[filterName]).toBe('function');
      });
    });

    it('should register all enhanced string filters', () => {
      const enhancedFilters = [
        'titleCase', 'sentenceCase', 'slug', 'humanize',
        'underscore', 'dasherize', 'classify', 'tableize',
        'camelize', 'demodulize', 'truncate', 'wrap',
        'pad', 'repeat', 'reverse', 'swapCase'
      ];

      enhancedFilters.forEach(filterName => {
        expect(nunjucksEnv.filters[filterName]).toBeDefined();
        expect(typeof nunjucksEnv.filters[filterName]).toBe('function');
      });
    });

    it('should register all date/time filters with aliases', () => {
      const dateFilters = [
        'formatDate', 'dateFormat',
        'dateAdd', 'dateSub', 'dateSubtract',
        'dateFrom', 'dateTo', 'fromNow', 'toNow',
        'dateStart', 'startOf', 'dateEnd', 'endOf',
        'isToday', 'isBefore', 'isAfter', 'dateDiff', 'diff',
        'dateUnix', 'unix', 'dateIso', 'iso',
        'dateUtc', 'utc', 'dateTimezone', 'tz'
      ];

      dateFilters.forEach(filterName => {
        expect(nunjucksEnv.filters[filterName]).toBeDefined();
        expect(typeof nunjucksEnv.filters[filterName]).toBe('function');
      });
    });

    it('should register all faker.js filters', () => {
      const fakerFilters = [
        'fakeName', 'fakeEmail', 'fakeAddress', 'fakeCity',
        'fakePhone', 'fakeCompany', 'fakeUuid', 'fakeNumber',
        'fakeText', 'fakeParagraph', 'fakeDate', 'fakeBoolean',
        'fakeArrayElement', 'fakeSeed', 'fakeLocale', 'fakeSchema'
      ];

      fakerFilters.forEach(filterName => {
        expect(nunjucksEnv.filters[filterName]).toBeDefined();
        expect(typeof nunjucksEnv.filters[filterName]).toBe('function');
      });
    });

    it('should register pluralization filters', () => {
      expect(nunjucksEnv.filters.pluralize).toBeDefined();
      expect(nunjucksEnv.filters.singular).toBeDefined();
    });

    it('should register utility filters', () => {
      expect(nunjucksEnv.filters.dump).toBeDefined();
      expect(nunjucksEnv.filters.join).toBeDefined();
      expect(nunjucksEnv.filters.default).toBeDefined();
    });
  });

  describe('Global Function Registration', () => {
    it('should register date/time globals', () => {
      expect(nunjucksEnv.globals.timestamp).toBeDefined();
      expect(nunjucksEnv.globals.now).toBeDefined();
      expect(nunjucksEnv.globals.formatDate).toBeDefined();
      expect(nunjucksEnv.globals.today).toBeDefined();
      expect(nunjucksEnv.globals.dayjs).toBeDefined();
    });

    it('should register faker.js globals', () => {
      const fakerGlobals = [
        'fakeName', 'fakeEmail', 'fakeAddress', 'fakeCity',
        'fakePhone', 'fakeCompany', 'fakeUuid', 'fakeNumber',
        'fakeText', 'fakeParagraph', 'fakeDate', 'fakeBoolean',
        'fakeArrayElement', 'fakeSeed', 'fakeLocale', 'fakeSchema'
      ];

      fakerGlobals.forEach(globalName => {
        expect(nunjucksEnv.globals[globalName]).toBeDefined();
        expect(typeof nunjucksEnv.globals[globalName]).toBe('function');
      });
    });

    it('should register configureFaker global', () => {
      expect(nunjucksEnv.globals.configureFaker).toBeDefined();
      expect(typeof nunjucksEnv.globals.configureFaker).toBe('function');
    });
  });

  describe('Filter Function Validation', () => {
    it('should validate basic case conversion filter execution', () => {
      const testString = 'hello_world_test';
      
      expect(nunjucksEnv.renderString('{{ str | pascalCase }}', { str: testString }))
        .toBe('HelloWorldTest');
      expect(nunjucksEnv.renderString('{{ str | camelCase }}', { str: testString }))
        .toBe('helloWorldTest');
      expect(nunjucksEnv.renderString('{{ str | kebabCase }}', { str: testString }))
        .toBe('hello-world-test');
      expect(nunjucksEnv.renderString('{{ str | snakeCase }}', { str: testString }))
        .toBe('hello_world_test');
      expect(nunjucksEnv.renderString('{{ str | constantCase }}', { str: testString }))
        .toBe('HELLO_WORLD_TEST');
    });

    it('should validate date filter execution', () => {
      const dateString = '2024-01-15T10:30:00Z';
      
      const formatted = nunjucksEnv.renderString('{{ date | formatDate("YYYY-MM-DD") }}', { date: dateString });
      expect(formatted).toBe('2024-01-15');
      
      const iso = nunjucksEnv.renderString('{{ date | dateIso }}', { date: dateString });
      expect(iso).toMatch(/2024-01-15T10:30:00/);
      
      const unix = nunjucksEnv.renderString('{{ date | dateUnix }}', { date: dateString });
      expect(parseInt(unix)).toBeGreaterThan(1700000000);
    });

    it('should validate faker filter execution', () => {
      const email = nunjucksEnv.renderString('{{ "" | fakeEmail }}');
      expect(email).toMatch(/@/);
      
      const uuid = nunjucksEnv.renderString('{{ "" | fakeUuid }}');
      expect(uuid).toMatch(/[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}/i);
      
      const number = nunjucksEnv.renderString('{{ "" | fakeNumber(1, 10) }}');
      const num = parseInt(number);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(10);
      
      const boolean = nunjucksEnv.renderString('{{ "" | fakeBoolean }}');
      expect(['true', 'false']).toContain(boolean);
    });

    it('should validate global function execution', () => {
      const timestamp = nunjucksEnv.renderString('{{ timestamp() }}');
      expect(timestamp).toMatch(/^\d{14}$/);
      
      const now = nunjucksEnv.renderString('{{ now() | formatDate("YYYY") }}');
      expect(parseInt(now)).toBeGreaterThanOrEqual(2024);
      
      const fakeGlobalName = nunjucksEnv.renderString('{{ fakeName() }}');
      expect(typeof fakeGlobalName).toBe('string');
      expect(fakeGlobalName.length).toBeGreaterThan(0);
    });
  });

  describe('Filter Chain Validation', () => {
    it('should handle complex filter chains correctly', () => {
      const result = nunjucksEnv.renderString(
        '{{ name | pluralize | kebabCase | upper }}',
        { name: 'blogPost' }
      );
      expect(result).toBe('BLOG-POSTS');
      
      const chainResult = nunjucksEnv.renderString(
        '{{ text | snakeCase | classify | pluralize }}',
        { text: 'user_profile_data' }
      );
      expect(chainResult).toBe('UserProfileDatas');
    });

    it('should handle mixed filter types in chains', () => {
      const result = nunjucksEnv.renderString(
        '{{ name | pascalCase }}-{{ now() | formatDate("YYYY") }}-{{ "" | fakeNumber(100, 999) }}',
        { name: 'test_component' }
      );
      expect(result).toMatch(/^TestComponent-\d{4}-\d{3}$/);
    });
  });

  describe('Error Handling in Filters', () => {
    it('should handle invalid inputs gracefully', () => {
      // Test with null/undefined
      expect(nunjucksEnv.renderString('{{ null | pascalCase }}')).toBe('');
      expect(nunjucksEnv.renderString('{{ undefined | kebabCase }}')).toBe('');
      
      // Test with invalid dates
      expect(nunjucksEnv.renderString('{{ "invalid" | formatDate }}')).toBe('');
      
      // Test with non-string inputs
      expect(nunjucksEnv.renderString('{{ 123 | pascalCase }}')).toBe('123');
      expect(nunjucksEnv.renderString('{{ [] | camelCase }}')).toBe('');
    });

    it('should continue processing after filter errors', () => {
      const template = `
        Valid: {{ "test" | pascalCase }}
        Invalid: {{ null | invalidFilter | pascalCase }}
        Valid again: {{ "component" | kebabCase }}
      `.trim();
      
      // Should not throw, continue processing
      expect(() => {
        nunjucksEnv.renderString(template);
      }).not.toThrow();
    });
  });

  describe('Performance Validation', () => {
    it('should handle many filter applications efficiently', () => {
      const template = Array.from({ length: 100 }, (_, i) => 
        `{{ "test${i}" | pascalCase | pluralize | kebabCase }}`
      ).join(' ');
      
      const startTime = Date.now();
      const result = nunjucksEnv.renderString(template);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.split(' ')).toHaveLength(100);
    });

    it('should efficiently handle faker filter calls', () => {
      const template = Array.from({ length: 50 }, () => 
        '{{ "" | fakeEmail }}'
      ).join(' ');
      
      const startTime = Date.now();
      const result = nunjucksEnv.renderString(template);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.split(' ').every(email => email.includes('@'))).toBe(true);
    });
  });
});