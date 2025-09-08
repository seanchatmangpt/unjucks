/**
 * String Inflection Filters Test Suite
 * Comprehensive testing of 15+ string transformation filters
 */

import { describe, it, expect, beforeAll } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../../src/lib/nunjucks-filters.js';

describe('String Inflection Filters (15+ filters)', () => {
  let env;

  beforeAll(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('Basic Case Conversion', () => {
    it('should convert to pascalCase', () => {
      expect(env.renderString('{{ "hello_world" | pascalCase }}')).toBe('HelloWorld');
      expect(env.renderString('{{ "user-account" | PascalCase }}')).toBe('UserAccount');
      expect(env.renderString('{{ "api endpoint" | pascalCase }}')).toBe('ApiEndpoint');
    });

    it('should convert to camelCase', () => {
      expect(env.renderString('{{ "hello_world" | camelCase }}')).toBe('helloWorld');
      expect(env.renderString('{{ "user-account" | camelCase }}')).toBe('userAccount');
      expect(env.renderString('{{ "API_ENDPOINT" | camelCase }}')).toBe('apiEndpoint');
    });

    it('should convert to kebab-case', () => {
      expect(env.renderString('{{ "HelloWorld" | kebabCase }}')).toBe('hello-world');
      expect(env.renderString('{{ "userAccount" | kebab-case }}')).toBe('user-account');
      expect(env.renderString('{{ "API_ENDPOINT" | kebabCase }}')).toBe('api-endpoint');
    });

    it('should convert to snake_case', () => {
      expect(env.renderString('{{ "HelloWorld" | snakeCase }}')).toBe('hello_world');
      expect(env.renderString('{{ "userAccount" | snake_case }}')).toBe('user_account');
      expect(env.renderString('{{ "API-ENDPOINT" | snakeCase }}')).toBe('api_endpoint');
    });

    it('should convert to CONSTANT_CASE', () => {
      expect(env.renderString('{{ "helloWorld" | constantCase }}')).toBe('HELLO_WORLD');
      expect(env.renderString('{{ "user-account" | CONSTANT_CASE }}')).toBe('USER_ACCOUNT');
      expect(env.renderString('{{ "api endpoint" | constantCase }}')).toBe('API_ENDPOINT');
    });
  });

  describe('Enhanced Inflection Filters', () => {
    it('should convert to Title Case', () => {
      expect(env.renderString('{{ "hello world" | titleCase }}')).toBe('Hello World');
      expect(env.renderString('{{ "user_account" | titleCase }}')).toBe('User_account');
      expect(env.renderString('{{ "API-endpoint" | titleCase }}')).toBe('Api-endpoint');
    });

    it('should convert to Sentence case', () => {
      expect(env.renderString('{{ "hello_world" | sentenceCase }}')).toBe('Hello world');
      expect(env.renderString('{{ "user-account" | sentenceCase }}')).toBe('User account');
      expect(env.renderString('{{ "API_ENDPOINT" | sentenceCase }}')).toBe('Api endpoint');
    });

    it('should create URL-safe slugs', () => {
      expect(env.renderString('{{ "Hello World!" | slug }}')).toBe('hello-world');
      expect(env.renderString('{{ "User Account & Settings" | slug }}')).toBe('user-account-settings');
      expect(env.renderString('{{ "API/Endpoint#Test" | slug }}')).toBe('apiendpointtest');
    });

    it('should humanize strings', () => {
      expect(env.renderString('{{ "user_name" | humanize }}')).toBe('User name');
      expect(env.renderString('{{ "userAccount" | humanize }}')).toBe('User account');
      expect(env.renderString('{{ "API_ENDPOINT" | humanize }}')).toBe('Api endpoint');
    });

    it('should underscore (alias for snakeCase)', () => {
      expect(env.renderString('{{ "HelloWorld" | underscore }}')).toBe('hello_world');
      expect(env.renderString('{{ "userAccount" | underscore }}')).toBe('user_account');
    });

    it('should dasherize (alias for kebabCase)', () => {
      expect(env.renderString('{{ "HelloWorld" | dasherize }}')).toBe('hello-world');
      expect(env.renderString('{{ "userAccount" | dasherize }}')).toBe('user-account');
    });

    it('should classify (singular PascalCase)', () => {
      expect(env.renderString('{{ "user_posts" | classify }}')).toBe('UserPost');
      expect(env.renderString('{{ "blog_comments" | classify }}')).toBe('BlogComment');
      expect(env.renderString('{{ "categories" | classify }}')).toBe('Category');
    });

    it('should tableize (plural snake_case)', () => {
      expect(env.renderString('{{ "UserPost" | tableize }}')).toBe('user_posts');
      expect(env.renderString('{{ "BlogComment" | tableize }}')).toBe('blog_comments');
      expect(env.renderString('{{ "Category" | tableize }}')).toBe('categories');
    });

    it('should camelize with options', () => {
      expect(env.renderString('{{ "hello_world" | camelize }}')).toBe('helloWorld');
      expect(env.renderString('{{ "hello_world" | camelize(true) }}')).toBe('HelloWorld');
    });

    it('should demodulize strings', () => {
      expect(env.renderString('{{ "Admin::Users::User" | demodulize }}')).toBe('User');
      expect(env.renderString('{{ "API/V1/Endpoint" | demodulize }}')).toBe('Endpoint');
      expect(env.renderString('{{ "Models\\User\\Profile" | demodulize }}')).toBe('Profile');
    });
  });

  describe('Advanced String Utilities', () => {
    it('should truncate strings', () => {
      expect(env.renderString('{{ "This is a very long string" | truncate(15) }}')).toBe('This is a ve...');
      expect(env.renderString('{{ "Short" | truncate(10) }}')).toBe('Short');
      expect(env.renderString('{{ "Custom suffix" | truncate(10, " [more]") }}')).toBe('Custom [more]');
    });

    it('should wrap text', () => {
      const longText = 'This is a very long line that should be wrapped at specified width';
      expect(env.renderString(`{{ "${longText}" | wrap(20) }}`))
        .toContain('This is a very long');
    });

    it('should pad strings', () => {
      expect(env.renderString('{{ "test" | pad(10) }}')).toBe('   test   ');
      expect(env.renderString('{{ "test" | pad(10, "*") }}')).toBe('***test***');
    });

    it('should repeat strings', () => {
      expect(env.renderString('{{ "ha" | repeat(3) }}')).toBe('hahaha');
      expect(env.renderString('{{ "-" | repeat(5) }}')).toBe('-----');
    });

    it('should reverse strings', () => {
      expect(env.renderString('{{ "hello" | reverse }}')).toBe('olleh');
      expect(env.renderString('{{ "12345" | reverse }}')).toBe('54321');
    });

    it('should swap case', () => {
      expect(env.renderString('{{ "Hello World" | swapCase }}')).toBe('hELLO wORLD');
      expect(env.renderString('{{ "CamelCase" | swapCase }}')).toBe('cAMELcASE');
    });
  });

  describe('Pluralization/Singularization', () => {
    it('should pluralize nouns', () => {
      expect(env.renderString('{{ "user" | pluralize }}')).toBe('users');
      expect(env.renderString('{{ "category" | pluralize }}')).toBe('categories');
      expect(env.renderString('{{ "box" | pluralize }}')).toBe('boxes');
      expect(env.renderString('{{ "class" | pluralize }}')).toBe('classes');
    });

    it('should singularize nouns', () => {
      expect(env.renderString('{{ "users" | singular }}')).toBe('user');
      expect(env.renderString('{{ "categories" | singular }}')).toBe('category');
      expect(env.renderString('{{ "boxes" | singular }}')).toBe('box');
      expect(env.renderString('{{ "classes" | singular }}')).toBe('class');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined values', () => {
      expect(env.renderString('{{ null | pascalCase }}')).toBe('');
      expect(env.renderString('{{ undefined | camelCase }}')).toBe('');
    });

    it('should handle empty strings', () => {
      expect(env.renderString('{{ "" | pascalCase }}')).toBe('');
      expect(env.renderString('{{ "" | slug }}')).toBe('');
    });

    it('should handle Unicode characters', () => {
      expect(env.renderString('{{ "hëllo wörld" | camelCase }}')).toBe('hëlloWörld');
      expect(env.renderString('{{ "café résumé" | kebabCase }}')).toBe('café-résumé');
    });

    it('should handle numbers and special characters', () => {
      expect(env.renderString('{{ "user123Account" | snakeCase }}')).toBe('user123_account');
      expect(env.renderString('{{ "API_V2_ENDPOINT" | humanize }}')).toBe('Api v2 endpoint');
    });
  });

  describe('Filter Chaining', () => {
    it('should chain string transformations', () => {
      expect(env.renderString('{{ "hello_world" | pascalCase | pluralize }}')).toBe('HelloWorlds');
      expect(env.renderString('{{ "UserAccount" | snakeCase | humanize }}')).toBe('User account');
      expect(env.renderString('{{ "api-endpoint" | camelCase | classify }}')).toBe('ApiEndpoint');
    });

    it('should chain with utility filters', () => {
      expect(env.renderString('{{ "hello world" | titleCase | truncate(8) }}')).toBe('Hello...');
      expect(env.renderString('{{ "test" | upperCase | repeat(2) }}')).toBe('TESTTEST');
    });
  });

  describe('Performance with Large Strings', () => {
    it('should handle large strings efficiently', () => {
      const largeString = 'word '.repeat(1000);
      const start = Date.now();
      env.renderString(`{{ "${largeString}" | camelCase }}`);
      const end = Date.now();
      expect(end - start).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle deeply nested transformations', () => {
      const template = '{{ "hello_world" | pascalCase | snakeCase | camelCase | kebabCase | humanize }}';
      const result = env.renderString(template);
      expect(result).toBe('Hello world');
    });
  });
});