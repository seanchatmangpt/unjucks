/**
 * Unit tests for individual Nunjucks filter functions
 * Tests each filter function in isolation to validate functionality
 */

import { describe, it, expect } from 'vitest';
import {
  pascalCase,
  camelCase,
  kebabCase,
  snakeCase,
  constantCase,
  capitalize,
  lowerCase,
  upperCase
} from '../../src/lib/nunjucks-filters.js';

describe('Case Conversion Filters', () => {
  describe('pascalCase filter', () => {
    it('should convert basic strings to PascalCase', () => {
      expect(pascalCase('hello world')).toBe('HelloWorld');
      expect(pascalCase('user-name')).toBe('UserName');
      expect(pascalCase('user_name')).toBe('UserName');
      expect(pascalCase('firstName')).toBe('FirstName');
    });

    it('should handle edge cases', () => {
      expect(pascalCase('')).toBe('');
      expect(pascalCase('a')).toBe('A');
      expect(pascalCase('user')).toBe('User');
      expect(pascalCase('USER')).toBe('USER');
    });

    it('should handle non-string inputs', () => {
      expect(pascalCase(null)).toBe(null);
      expect(pascalCase(undefined)).toBe(undefined);
      expect(pascalCase(123)).toBe(123);
      expect(pascalCase([])).toEqual([]);
    });

    it('should handle complex strings', () => {
      expect(pascalCase('my-long_variable name')).toBe('MyLongVariableName');
      expect(pascalCase('  multiple   spaces  ')).toBe('MultipleSpaces');
      expect(pascalCase('with123numbers')).toBe('With123numbers');
    });
  });

  describe('camelCase filter', () => {
    it('should convert basic strings to camelCase', () => {
      expect(camelCase('hello world')).toBe('helloWorld');
      expect(camelCase('user-name')).toBe('userName');
      expect(camelCase('user_name')).toBe('userName');
      expect(camelCase('FirstName')).toBe('firstName');
    });

    it('should handle edge cases', () => {
      expect(camelCase('')).toBe('');
      expect(camelCase('a')).toBe('a');
      expect(camelCase('user')).toBe('user');
      expect(camelCase('USER')).toBe('uSER');
    });

    it('should handle non-string inputs', () => {
      expect(camelCase(null)).toBe(null);
      expect(camelCase(undefined)).toBe(undefined);
      expect(camelCase(123)).toBe(123);
    });
  });

  describe('kebabCase filter', () => {
    it('should convert basic strings to kebab-case', () => {
      expect(kebabCase('HelloWorld')).toBe('hello-world');
      expect(kebabCase('userProfile')).toBe('user-profile');
      expect(kebabCase('user_name')).toBe('user-name');
      expect(kebabCase('user name')).toBe('user-name');
    });

    it('should handle edge cases', () => {
      expect(kebabCase('')).toBe('');
      expect(kebabCase('a')).toBe('a');
      expect(kebabCase('USER')).toBe('user');
    });

    it('should handle non-string inputs', () => {
      expect(kebabCase(null)).toBe(null);
      expect(kebabCase(undefined)).toBe(undefined);
      expect(kebabCase(123)).toBe(123);
    });

    it('should handle complex transformations', () => {
      expect(kebabCase('XMLHttpRequest')).toBe('xmlhttp-request');
      expect(kebabCase('getUserByID')).toBe('get-user-by-id');
      expect(kebabCase('HTML_Parser')).toBe('html-parser');
    });
  });

  describe('snakeCase filter', () => {
    it('should convert basic strings to snake_case', () => {
      expect(snakeCase('HelloWorld')).toBe('hello_world');
      expect(snakeCase('userProfile')).toBe('user_profile');
      expect(snakeCase('user-name')).toBe('user_name');
      expect(snakeCase('user name')).toBe('user_name');
    });

    it('should handle edge cases', () => {
      expect(snakeCase('')).toBe('');
      expect(snakeCase('a')).toBe('a');
      expect(snakeCase('USER')).toBe('user');
    });

    it('should handle non-string inputs', () => {
      expect(snakeCase(null)).toBe(null);
      expect(snakeCase(undefined)).toBe(undefined);
      expect(snakeCase(123)).toBe(123);
    });
  });

  describe('constantCase filter', () => {
    it('should convert basic strings to CONSTANT_CASE', () => {
      expect(constantCase('HelloWorld')).toBe('HELLO_WORLD');
      expect(constantCase('userProfile')).toBe('USER_PROFILE');
      expect(constantCase('user-name')).toBe('USER_NAME');
      expect(constantCase('user name')).toBe('USER_NAME');
    });

    it('should handle edge cases', () => {
      expect(constantCase('')).toBe('');
      expect(constantCase('a')).toBe('A');
      expect(constantCase('user')).toBe('USER');
    });

    it('should handle non-string inputs', () => {
      expect(constantCase(null)).toBe(null);
      expect(constantCase(undefined)).toBe(undefined);
      expect(constantCase(123)).toBe(123);
    });
  });

  describe('capitalize filter', () => {
    it('should capitalize first letter and lowercase rest', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('Hello');
      expect(capitalize('hELLO')).toBe('Hello');
    });

    it('should handle edge cases', () => {
      expect(capitalize('')).toBe('');
      expect(capitalize('a')).toBe('A');
      expect(capitalize('A')).toBe('A');
    });

    it('should handle non-string inputs', () => {
      expect(capitalize(null)).toBe(null);
      expect(capitalize(undefined)).toBe(undefined);
      expect(capitalize(123)).toBe(123);
    });
  });

  describe('lowerCase filter', () => {
    it('should convert strings to lowercase', () => {
      expect(lowerCase('HELLO')).toBe('hello');
      expect(lowerCase('Hello')).toBe('hello');
      expect(lowerCase('hELLO')).toBe('hello');
    });

    it('should handle edge cases', () => {
      expect(lowerCase('')).toBe('');
      expect(lowerCase('123')).toBe('123');
    });

    it('should handle non-string inputs', () => {
      expect(lowerCase(null)).toBe(null);
      expect(lowerCase(undefined)).toBe(undefined);
      expect(lowerCase(123)).toBe(123);
    });
  });

  describe('upperCase filter', () => {
    it('should convert strings to uppercase', () => {
      expect(upperCase('hello')).toBe('HELLO');
      expect(upperCase('Hello')).toBe('HELLO');
      expect(upperCase('hELLO')).toBe('HELLO');
    });

    it('should handle edge cases', () => {
      expect(upperCase('')).toBe('');
      expect(upperCase('123')).toBe('123');
    });

    it('should handle non-string inputs', () => {
      expect(upperCase(null)).toBe(null);
      expect(upperCase(undefined)).toBe(undefined);
      expect(upperCase(123)).toBe(123);
    });
  });
});

describe('String Utility Filters', () => {
  // Import additional filters for testing (need to add imports)
  // These tests will reveal which functions are actually exported
  
  describe('String transformation edge cases', () => {
    it('should handle special characters', () => {
      expect(kebabCase('user@name')).toBe('user@name'); // Should this be cleaned?
      expect(snakeCase('user.profile')).toBe('user.profile'); // Should this be cleaned?
    });

    it('should handle unicode characters', () => {
      expect(pascalCase('café-naïve')).toBe('CaféNaïve');
      expect(camelCase('café naïve')).toBe('caféNaïve');
    });

    it('should handle numbers in strings', () => {
      expect(pascalCase('user123-profile456')).toBe('User123Profile456');
      expect(kebabCase('User123Profile')).toBe('user123-profile');
    });
  });
});

describe('Performance Tests', () => {
  it('should handle long strings efficiently', () => {
    const longString = 'a'.repeat(1000) + '-' + 'b'.repeat(1000);
    
    const start = performance.now();
    const result = pascalCase(longString);
    const duration = performance.now() - start;
    
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(duration).toBeLessThan(10); // Should process in less than 10ms
  });

  it('should handle many small conversions efficiently', () => {
    const testStrings = Array(1000).fill(0).map((_, i) => `test-string-${i}`);
    
    const start = performance.now();
    const results = testStrings.map(str => camelCase(str));
    const duration = performance.now() - start;
    
    expect(results[0]).toBe('testString0');
    expect(results[999]).toBe('testString999');
    expect(duration).toBeLessThan(100); // Should process 1000 strings in less than 100ms
  });
});