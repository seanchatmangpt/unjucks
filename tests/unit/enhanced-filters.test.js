import { describe, it, expect } from 'vitest';
import {
  titleCase,
  sentenceCase,
  slug,
  humanize,
  underscore,
  dasherize,
  classify,
  tableize,
  camelize,
  demodulize,
  truncate,
  wrap,
  pad,
  repeat,
  reverse,
  swapCase
} from '../../src/lib/nunjucks-filters.js';

describe('Enhanced Nunjucks Filters', () => {
  describe('Inflection Filters', () => {
    it('should convert to title case', () => {
      expect(titleCase('hello world')).toBe('Hello World');
      expect(titleCase('hello-world')).toBe('Hello-World');
      expect(titleCase('HELLO WORLD')).toBe('Hello World');
    });

    it('should convert to sentence case', () => {
      expect(sentenceCase('hello_world')).toBe('Hello world');
      expect(sentenceCase('hello-world')).toBe('Hello world');
      expect(sentenceCase('HELLO_WORLD')).toBe('Hello world');
    });

    it('should create URL-safe slugs', () => {
      expect(slug('Hello World!')).toBe('hello-world');
      expect(slug('Hello World!', '_')).toBe('hello_world');
      expect(slug('Multiple   Spaces')).toBe('multiple-spaces');
      expect(slug('Special@#$Characters')).toBe('specialcharacters');
    });

    it('should humanize strings', () => {
      expect(humanize('user_name')).toBe('User name');
      expect(humanize('firstName')).toBe('First name');
      expect(humanize('first-name')).toBe('First name');
    });

    it('should underscore (alias for snake_case)', () => {
      expect(underscore('HelloWorld')).toBe('hello_world');
      expect(underscore('hello-world')).toBe('hello_world');
    });

    it('should dasherize (alias for kebab-case)', () => {
      expect(dasherize('HelloWorld')).toBe('hello-world');
      expect(dasherize('hello_world')).toBe('hello-world');
    });

    it('should classify (singular PascalCase)', () => {
      expect(classify('user_posts')).toBe('UserPost');
      expect(classify('admin_users')).toBe('AdminUser');
      expect(classify('categories')).toBe('Category');
    });

    it('should tableize (plural snake_case)', () => {
      expect(tableize('UserPost')).toBe('user_posts');
      expect(tableize('AdminUser')).toBe('admin_users');
      expect(tableize('Category')).toBe('categories');
    });

    it('should camelize with optional first letter', () => {
      expect(camelize('hello_world')).toBe('helloWorld');
      expect(camelize('hello_world', true)).toBe('HelloWorld');
      expect(camelize('hello-world')).toBe('helloWorld');
    });

    it('should demodulize (remove namespaces)', () => {
      expect(demodulize('Admin::Users::User')).toBe('User');
      expect(demodulize('App/Models/User')).toBe('User');
      expect(demodulize('App\\Models\\User')).toBe('User');
      expect(demodulize('SimpleClass')).toBe('SimpleClass');
    });
  });

  describe('Advanced String Utilities', () => {
    it('should truncate strings', () => {
      expect(truncate('This is a long string', 10)).toBe('This is...');
      expect(truncate('Short', 10)).toBe('Short');
      expect(truncate('Custom suffix', 10, '…')).toBe('Custom s…');
    });

    it('should wrap text', () => {
      expect(wrap('This is a long line of text', 10)).toBe('This is a\nlong line\nof text');
      expect(wrap('Short', 10)).toBe('Short');
    });

    it('should pad strings', () => {
      expect(pad('test', 8)).toBe('  test  ');
      expect(pad('test', 7)).toBe(' test  ');
      expect(pad('test', 8, '-')).toBe('--test--');
      expect(pad('longstring', 5)).toBe('longstring');
    });

    it('should repeat strings', () => {
      expect(repeat('abc', 3)).toBe('abcabcabc');
      expect(repeat('x', 5)).toBe('xxxxx');
      expect(repeat('test', 0)).toBe('');
    });

    it('should reverse strings', () => {
      expect(reverse('hello')).toBe('olleh');
      expect(reverse('12345')).toBe('54321');
      expect(reverse('')).toBe('');
    });

    it('should swap case', () => {
      expect(swapCase('Hello World')).toBe('hELLO wORLD');
      expect(swapCase('ABC123def')).toBe('abc123DEF');
    });
  });

  describe('Input Validation', () => {
    it('should handle non-string inputs gracefully', () => {
      expect(titleCase(null)).toBe(null);
      expect(titleCase(123)).toBe(123);
      expect(titleCase(undefined)).toBe(undefined);
      
      expect(slug(null)).toBe(null);
      expect(humanize(123)).toBe(123);
      expect(truncate(undefined)).toBe(undefined);
    });
  });
});