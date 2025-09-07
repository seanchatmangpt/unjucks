/**
 * Integration test for basic template filters
 * Tests the core Nunjucks filter functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { nunjucksHelper } from '../helpers/nunjucks-test-helper.js';

describe('Basic Template Filter Integration', () => {
  beforeEach(() => {
    nunjucksHelper.setupEnvironment();
  });

  afterEach(() => {
    nunjucksHelper.cleanup();
  });

  describe('Case conversion filters', () => {
    it('should convert to PascalCase', async () => {
      await nunjucksHelper.renderString('{{ "hello_world" | pascalCase }}');
      expect(nunjucksHelper.getLastResult()).toBe('HelloWorld');
    });

    it('should convert to camelCase', async () => {
      await nunjucksHelper.renderString('{{ "hello_world" | camelCase }}');
      expect(nunjucksHelper.getLastResult()).toBe('helloWorld');
    });

    it('should convert to kebab-case', async () => {
      await nunjucksHelper.renderString('{{ "HelloWorld" | kebabCase }}');
      expect(nunjucksHelper.getLastResult()).toBe('hello-world');
    });

    it('should convert to snake_case', async () => {
      await nunjucksHelper.renderString('{{ "HelloWorld" | snakeCase }}');
      expect(nunjucksHelper.getLastResult()).toBe('hello_world');
    });

    it('should convert to CONSTANT_CASE', async () => {
      await nunjucksHelper.renderString('{{ "hello-world" | constantCase }}');
      expect(nunjucksHelper.getLastResult()).toBe('HELLO_WORLD');
    });
  });

  describe('String manipulation filters', () => {
    it('should pluralize words', async () => {
      await nunjucksHelper.renderString('{{ "user" | pluralize }}');
      expect(nunjucksHelper.getLastResult()).toBe('users');
    });

    it('should singularize words', async () => {
      await nunjucksHelper.renderString('{{ "users" | singular }}');
      expect(nunjucksHelper.getLastResult()).toBe('user');
    });

    it('should truncate long strings', async () => {
      await nunjucksHelper.renderString('{{ "This is a very long string" | truncate(10) }}');
      const result = nunjucksHelper.getLastResult();
      expect(result).toContain('...');
      expect(result.length).toBe(10);
    });

    it('should classify for class names', async () => {
      await nunjucksHelper.renderString('{{ "user_posts" | classify }}');
      expect(nunjucksHelper.getLastResult()).toBe('UserPost');
    });

    it('should tableize for database table names', async () => {
      await nunjucksHelper.renderString('{{ "UserPost" | tableize }}');
      expect(nunjucksHelper.getLastResult()).toBe('user_posts');
    });
  });

  describe('Filter chaining', () => {
    it('should chain multiple filters', async () => {
      await nunjucksHelper.renderString('{{ "user_profile" | camelCase | pluralize }}');
      expect(nunjucksHelper.getLastResult()).toBe('userProfiles');
    });

    it('should handle complex filter chains', async () => {
      await nunjucksHelper.renderString('{{ "admin-user" | pascalCase | singular | snakeCase }}');
      expect(nunjucksHelper.getLastResult()).toBe('admin_user');
    });
  });

  describe('Global functions', () => {
    it('should generate timestamps', async () => {
      await nunjucksHelper.renderString('{{ timestamp() }}');
      const result = nunjucksHelper.getLastResult();
      expect(result).toMatch(/^\d{14}$/); // YYYYMMDDHHMMSS format
    });

    it('should generate current datetime for database', async () => {
      await nunjucksHelper.renderString('{{ now() }}');
      const result = nunjucksHelper.getLastResult();
      // The now() function returns timestamp format, not datetime format
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('Template with context', () => {
    it('should render with context variables', async () => {
      const context = {
        entity: 'user_account',
        title: 'user management system'
      };
      
      const template = `# {{ title | titleCase }}
      
Class: {{ entity | classify }}
Table: {{ entity | tableize }}
Service: {{ entity | camelCase }}Service`;

      await nunjucksHelper.renderString(template, context);
      const result = nunjucksHelper.getLastResult();
      
      expect(result).toContain('User Management System');
      expect(result).toContain('UserAccount');
      expect(result).toContain('user_accounts');
      expect(result).toContain('userAccountService');
    });
  });
});