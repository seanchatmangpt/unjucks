/**
 * Integration test for datetime and faker filters
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { nunjucksHelper } from '../helpers/nunjucks-test-helper.js';
import dayjs from 'dayjs';

describe('DateTime and Faker Filter Integration', () => {
  beforeEach(() => {
    nunjucksHelper.setupEnvironment();
  });

  afterEach(() => {
    nunjucksHelper.cleanup();
  });

  describe('DateTime filters', () => {
    it('should format dates', async () => {
      const testDate = '2024-01-15T10:30:00Z';
      await nunjucksHelper.renderString('{{ testDate | dateFormat("YYYY-MM-DD") }}', { testDate });
      expect(nunjucksHelper.getLastResult()).toBe('2024-01-15');
    });

    it('should add time to dates', async () => {
      const testDate = '2024-01-15T10:30:00Z';
      await nunjucksHelper.renderString('{{ testDate | dateAdd(7, "day") | dateFormat("YYYY-MM-DD") }}', { testDate });
      expect(nunjucksHelper.getLastResult()).toBe('2024-01-22');
    });

    it('should subtract time from dates', async () => {
      const testDate = '2024-01-15T10:30:00Z';
      await nunjucksHelper.renderString('{{ testDate | dateSubtract(5, "day") | dateFormat("YYYY-MM-DD") }}', { testDate });
      expect(nunjucksHelper.getLastResult()).toBe('2024-01-10');
    });
  });

  describe('Faker filters', () => {
    it('should generate fake names', async () => {
      await nunjucksHelper.renderString('{{ "" | fakerName }}');
      const result = nunjucksHelper.getLastResult();
      expect(result).toMatch(/^[A-Za-z]+\s+[A-Za-z]+/);
      expect(result.length).toBeGreaterThan(2);
    });

    it('should generate fake emails', async () => {
      await nunjucksHelper.renderString('{{ "" | fakerEmail }}');
      const result = nunjucksHelper.getLastResult();
      expect(result).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should generate fake UUIDs', async () => {
      await nunjucksHelper.renderString('{{ "" | fakerUuid }}');
      const result = nunjucksHelper.getLastResult();
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should generate lorem text with specified word count', async () => {
      await nunjucksHelper.renderString('{{ "" | fakerLorem(3) }}');
      const result = nunjucksHelper.getLastResult();
      const words = result.trim().split(/\s+/);
      expect(words.length).toBe(3);
    });
  });

  describe('Combined filters with faker and case conversion', () => {
    it('should combine faker with case filters', async () => {
      await nunjucksHelper.renderString('{{ "" | fakerName | upperCase }}');
      const result = nunjucksHelper.getLastResult();
      expect(result).toBe(result.toUpperCase());
      expect(result).toMatch(/^[A-Z\s\.]+$/); // Include dots for titles like MR.
    });

    it('should use faker data in templates', async () => {
      const template = `# User Profile

Name: {{ '' | fakerName }}
Email: {{ '' | fakerEmail | lowerCase }}
Company: {{ '' | fakerCompany | titleCase }}
ID: {{ '' | fakerUuid }}`;

      await nunjucksHelper.renderString(template);
      const result = nunjucksHelper.getLastResult();
      
      expect(result).toContain('User Profile');
      expect(result).toMatch(/Name: [A-Za-z\s]+/);
      expect(result).toMatch(/Email: [^\s@]+@[^\s@]+\.[^\s@]+/);
      expect(result).toMatch(/Company: [A-Za-z\s]+/);
      expect(result).toMatch(/ID: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    });
  });

  describe('File injection simulation', () => {
    it('should render template for file injection', async () => {
      const template = `// Generated method
function {{ methodName | camelCase }}() {
  return {
    id: '{{ '' | fakerUuid }}',
    name: '{{ '' | fakerName }}',
    createdAt: '{{ now() }}'
  };
}`;

      await nunjucksHelper.renderString(template, { methodName: 'get_user_data' });
      const result = nunjucksHelper.getLastResult();
      
      expect(result).toContain('function getUserData()');
      expect(result).toMatch(/id: '[0-9a-f-]+'/);
      expect(result).toMatch(/name: '[A-Za-z\s]+'/);
      expect(result).toMatch(/createdAt: '\d+/);
    });
  });
});