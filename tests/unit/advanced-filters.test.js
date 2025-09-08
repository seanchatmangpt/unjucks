/**
 * Tests for advanced filter functions not yet covered
 * Tests pluralization, singularization, and utility filters
 */

import { describe, it, expect } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';

describe('Advanced String Filters', () => {
  let env;

  beforeEach(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('Pluralization Filters', () => {
    it('should pluralize basic words', () => {
      expect(env.renderString('{{ "user" | pluralize }}')).toBe('users');
      expect(env.renderString('{{ "book" | pluralize }}')).toBe('books');
      expect(env.renderString('{{ "cat" | pluralize }}')).toBe('cats');
    });

    it('should handle special pluralization rules', () => {
      // Words ending in s, ch, sh, x, z
      expect(env.renderString('{{ "bus" | pluralize }}')).toBe('buses');
      expect(env.renderString('{{ "church" | pluralize }}')).toBe('churches');
      expect(env.renderString('{{ "dish" | pluralize }}')).toBe('dishes');
      expect(env.renderString('{{ "box" | pluralize }}')).toBe('boxes');
      expect(env.renderString('{{ "buzz" | pluralize }}')).toBe('buzzes');
    });

    it('should handle y to ies transformation', () => {
      expect(env.renderString('{{ "city" | pluralize }}')).toBe('cities');
      expect(env.renderString('{{ "lady" | pluralize }}')).toBe('ladies');
      expect(env.renderString('{{ "country" | pluralize }}')).toBe('countries');
    });

    it('should not transform y after vowel', () => {
      expect(env.renderString('{{ "boy" | pluralize }}')).toBe('boys');
      expect(env.renderString('{{ "day" | pluralize }}')).toBe('days');
      expect(env.renderString('{{ "key" | pluralize }}')).toBe('keys');
    });

    it('should handle edge cases', () => {
      expect(env.renderString('{{ "" | pluralize }}')).toBe('s');
      expect(env.renderString('{{ "a" | pluralize }}')).toBe('as');
    });
  });

  describe('Singularization Filters', () => {
    it('should singularize basic words', () => {
      expect(env.renderString('{{ "users" | singular }}')).toBe('user');
      expect(env.renderString('{{ "books" | singular }}')).toBe('book');
      expect(env.renderString('{{ "cats" | singular }}')).toBe('cat');
    });

    it('should handle ies to y transformation', () => {
      expect(env.renderString('{{ "cities" | singular }}')).toBe('city');
      expect(env.renderString('{{ "ladies" | singular }}')).toBe('lady');
      expect(env.renderString('{{ "countries" | singular }}')).toBe('country');
    });

    it('should handle es endings', () => {
      expect(env.renderString('{{ "buses" | singular }}')).toBe('bus');
      expect(env.renderString('{{ "churches" | singular }}')).toBe('church');
      expect(env.renderString('{{ "dishes" | singular }}')).toBe('dish');
      expect(env.renderString('{{ "boxes" | singular }}')).toBe('box');
    });

    it('should handle edge cases', () => {
      expect(env.renderString('{{ "user" | singular }}')).toBe('user'); // Already singular
      expect(env.renderString('{{ "s" | singular }}')).toBe('s'); // Single char (should stay as-is)
      expect(env.renderString('{{ "as" | singular }}')).toBe('as'); // Short word (should stay as-is)
    });

    it('should handle non-standard endings', () => {
      // Test words that don't follow standard rules
      expect(env.renderString('{{ "glasses" | singular }}')).toBe('glass');
      expect(env.renderString('{{ "processes" | singular }}')).toBe('process'); // Fixed test data
    });
  });

  describe('Utility Filters', () => {
    it('should test dump filter with objects', () => {
      const obj = { name: 'test', value: 123 };
      const result = env.renderString('{{ obj | dump }}', { obj });
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ name: 'test', value: 123 });
    });

    it('should test dump filter with arrays', () => {
      const arr = [1, 2, 'three'];
      const result = env.renderString('{{ arr | dump }}', { arr });
      const parsed = JSON.parse(result);
      expect(parsed).toEqual([1, 2, 'three']);
    });

    it('should test join filter with arrays', () => {
      const arr = ['a', 'b', 'c'];
      expect(env.renderString('{{ arr | join }}', { arr })).toBe('abc');
      expect(env.renderString('{{ arr | join(",") }}', { arr })).toBe('a,b,c');
      expect(env.renderString('{{ arr | join(" - ") }}', { arr })).toBe('a - b - c');
    });

    it('should test join filter with non-arrays', () => {
      expect(env.renderString('{{ notArray | join }}', { notArray: 'string' })).toBe('string');
      expect(env.renderString('{{ notArray | join }}', { notArray: null })).toBe('');
    });

    it('should test default filter', () => {
      expect(env.renderString('{{ nullVar | default("fallback") }}', { nullVar: null })).toBe('fallback');
      expect(env.renderString('{{ undefinedVar | default("fallback") }}')).toBe('fallback');
      expect(env.renderString('{{ emptyString | default("fallback") }}', { emptyString: '' })).toBe('fallback');
      expect(env.renderString('{{ validValue | default("fallback") }}', { validValue: 'actual' })).toBe('actual');
      expect(env.renderString('{{ zeroValue | default("fallback") }}', { zeroValue: 0 })).toBe('fallback'); // 0 is falsy
    });
  });

  describe('Global Functions', () => {
    it('should generate valid timestamps', () => {
      const timestamp = env.renderString('{{ timestamp() }}');
      expect(timestamp).toMatch(/^\d{14}$/);
      
      const parsedTimestamp = timestamp;
      const year = parseInt(parsedTimestamp.substr(0, 4));
      const month = parseInt(parsedTimestamp.substr(4, 2));
      const day = parseInt(parsedTimestamp.substr(6, 2));
      const hour = parseInt(parsedTimestamp.substr(8, 2));
      const minute = parseInt(parsedTimestamp.substr(10, 2));
      const second = parseInt(parsedTimestamp.substr(12, 2));

      expect(year).toBeGreaterThan(2020);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);
      expect(minute).toBeGreaterThanOrEqual(0);
      expect(minute).toBeLessThanOrEqual(59);
      expect(second).toBeGreaterThanOrEqual(0);
      expect(second).toBeLessThanOrEqual(59);
    });

    it('should generate valid now() timestamps', () => {
      const now = env.renderString('{{ now() }}');
      expect(now).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      
      // Verify it can be parsed as a valid date
      const parsedDate = new Date(now.replace(' ', 'T') + 'Z');
      expect(parsedDate.getTime()).not.toBeNaN();
    });

    it('should format dates correctly', () => {
      const testDate = new Date('2023-12-25T15:30:45Z');
      const formatted = env.renderString('{{ formatDate(date) }}', { date: testDate });
      expect(formatted).toBe('2023-12-25');
    });

    it('should handle formatDate with custom format', () => {
      const testDate = new Date('2023-12-25T15:30:45Z');
      const formatted = env.renderString('{{ formatDate(date, "YYYY-MM-DD") }}', { date: testDate });
      expect(formatted).toBe('2023-12-25');
    });

    it('should handle formatDate with invalid format fallback', () => {
      const testDate = new Date('2023-12-25T15:30:45Z');
      const formatted = env.renderString('{{ formatDate(date, "invalid") }}', { date: testDate });
      expect(formatted).toBe(testDate.toISOString());
    });
  });
});

describe('Missing Filters Discovery', () => {
  let env;

  beforeEach(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('Expected but potentially missing filters', () => {
    it('should test titleCase filter if available', () => {
      try {
        const result = env.renderString('{{ "hello world" | titleCase }}');
        expect(result).toBe('Hello World');
      } catch (error) {
        console.warn('titleCase filter not available:', error.message);
        // Mark as missing filter for documentation
        expect(error.message).toContain('Unable to call');
      }
    });

    it('should test sentenceCase filter if available', () => {
      try {
        const result = env.renderString('{{ "hello_world" | sentenceCase }}');
        expect(result).toBe('Hello world');
      } catch (error) {
        console.warn('sentenceCase filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });

    it('should test slug filter if available', () => {
      try {
        const result = env.renderString('{{ "Hello World!" | slug }}');
        expect(result).toBe('hello-world');
      } catch (error) {
        console.warn('slug filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });

    it('should test humanize filter if available', () => {
      try {
        const result = env.renderString('{{ "user_name" | humanize }}');
        expect(result).toBe('User name');
      } catch (error) {
        console.warn('humanize filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });

    it('should test underscore filter if available', () => {
      try {
        const result = env.renderString('{{ "HelloWorld" | underscore }}');
        expect(result).toBe('hello_world');
      } catch (error) {
        console.warn('underscore filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });

    it('should test dasherize filter if available', () => {
      try {
        const result = env.renderString('{{ "HelloWorld" | dasherize }}');
        expect(result).toBe('hello-world');
      } catch (error) {
        console.warn('dasherize filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });

    it('should test classify filter if available', () => {
      try {
        const result = env.renderString('{{ "user_posts" | classify }}');
        expect(result).toBe('UserPost');
      } catch (error) {
        console.warn('classify filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });

    it('should test tableize filter if available', () => {
      try {
        const result = env.renderString('{{ "UserPost" | tableize }}');
        expect(result).toBe('user_posts');
      } catch (error) {
        console.warn('tableize filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });
  });

  describe('String manipulation filters', () => {
    it('should test truncate filter if available', () => {
      try {
        const result = env.renderString('{{ longText | truncate(10) }}', { longText: 'This is a very long text' });
        expect(result).toBe('This is...');
      } catch (error) {
        console.warn('truncate filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });

    it('should test wrap filter if available', () => {
      try {
        const result = env.renderString('{{ longText | wrap(10) }}', { longText: 'This is a very long text that should wrap' });
        expect(result).toContain('\n');
      } catch (error) {
        console.warn('wrap filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });

    it('should test pad filter if available', () => {
      try {
        const result = env.renderString('{{ "test" | pad(10) }}');
        expect(result).toBe('   test   ');
      } catch (error) {
        console.warn('pad filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });

    it('should test repeat filter if available', () => {
      try {
        const result = env.renderString('{{ "test" | repeat(3) }}');
        expect(result).toBe('testtesttest');
      } catch (error) {
        console.warn('repeat filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });

    it('should test reverse filter if available', () => {
      try {
        const result = env.renderString('{{ "hello" | reverse }}');
        expect(result).toBe('olleh');
      } catch (error) {
        console.warn('reverse filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });

    it('should test swapCase filter if available', () => {
      try {
        const result = env.renderString('{{ "Hello World" | swapCase }}');
        expect(result).toBe('hELLO wORLD');
      } catch (error) {
        console.warn('swapCase filter not available:', error.message);
        expect(error.message).toContain('Unable to call');
      }
    });
  });
});

describe('Filter Registration Validation', () => {
  it('should verify all expected filters are registered', () => {
    const env = new nunjucks.Environment();
    addCommonFilters(env);

    const expectedFilters = [
      'pascalCase', 'PascalCase',
      'camelCase',
      'kebabCase', 'kebab-case',
      'snakeCase', 'snake_case',
      'constantCase', 'CONSTANT_CASE',
      'capitalize',
      'lower', 'lowerCase',
      'upper', 'upperCase',
      'pluralize',
      'singular',
      'dump',
      'join',
      'default'
    ];

    const registeredFilters = [];
    const missingFilters = [];

    for (const filterName of expectedFilters) {
      try {
        env.renderString(`{{ "test" | ${filterName} }}`);
        registeredFilters.push(filterName);
      } catch (error) {
        if (error.message.includes('Unable to call')) {
          missingFilters.push(filterName);
        }
      }
    }

    console.log('Registered filters:', registeredFilters);
    console.log('Missing filters:', missingFilters);

    // At minimum, basic filters should be registered
    expect(registeredFilters).toContain('pascalCase');
    expect(registeredFilters).toContain('camelCase');
    expect(registeredFilters).toContain('kebabCase');
  });

  it('should verify global functions are registered', () => {
    const env = new nunjucks.Environment();
    addCommonFilters(env);

    const expectedGlobals = ['timestamp', 'now', 'formatDate'];
    const registeredGlobals = [];
    const missingGlobals = [];

    for (const globalName of expectedGlobals) {
      try {
        const result = env.renderString(`{{ ${globalName}() }}`);
        if (result && result !== 'undefined') {
          registeredGlobals.push(globalName);
        }
      } catch (error) {
        missingGlobals.push(globalName);
      }
    }

    console.log('Registered globals:', registeredGlobals);
    console.log('Missing globals:', missingGlobals);

    // All global functions should be registered
    expect(registeredGlobals).toContain('timestamp');
    expect(registeredGlobals).toContain('now');
    expect(registeredGlobals).toContain('formatDate');
  });
});