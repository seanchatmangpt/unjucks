/**
 * Test suite for Date/Time filters powered by Day.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';

describe('Date/Time Filters (Day.js)', () => {
  let env;
  
  beforeEach(() => {
    env = nunjucks.configure({ autoescape: false });
    addCommonFilters(env);
  });

  describe('formatDate filter', () => {
    it('should format date with default format', () => {
      const template = env.renderString('{{ "2023-12-25" | formatDate }}');
      expect(template).toBe('2023-12-25');
    });

    it('should format date with custom format', () => {
      const template = env.renderString('{{ "2023-12-25T10:30:00" | formatDate("YYYY_MM_DD_HHmmss") }}');
      expect(template).toBe('2023_12_25_103000');
    });

    it('should handle invalid dates gracefully', () => {
      const template = env.renderString('{{ "invalid-date" | formatDate }}');
      expect(template).toBe('');
    });
  });

  describe('dateAdd and dateSub filters', () => {
    it('should add days to date', () => {
      const template = env.renderString('{{ "2023-12-25" | dateAdd(5, "day") | formatDate }}');
      expect(template).toBe('2023-12-30');
    });

    it('should subtract months from date', () => {
      const template = env.renderString('{{ "2023-12-25" | dateSub(1, "month") | formatDate }}');
      expect(template).toBe('2023-11-25');
    });

    it('should chain date operations', () => {
      const template = env.renderString('{{ "2023-12-25" | dateAdd(1, "year") | dateSub(6, "month") | formatDate }}');
      expect(template).toBe('2024-06-25');
    });
  });

  describe('relative time filters', () => {
    it('should return relative time with dateFrom', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const template = env.renderString(`{{ "${yesterday}" | dateFrom }}`);
      expect(template).toContain('a day ago');
    });

    it('should work with dateFrom without suffix', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const template = env.renderString(`{{ "${yesterday}" | dateFrom(true) }}`);
      expect(template).toContain('a day');
      expect(template).not.toContain('ago');
    });
  });

  describe('start/end of time period filters', () => {
    it('should get start of day', () => {
      const template = env.renderString('{{ "2023-12-25T15:30:45" | dateStart("day") | formatDate("YYYY-MM-DD HH:mm:ss") }}');
      expect(template).toBe('2023-12-25 00:00:00');
    });

    it('should get end of month', () => {
      const template = env.renderString('{{ "2023-02-15" | dateEnd("month") | formatDate("YYYY-MM-DD") }}');
      expect(template).toBe('2023-02-28');
    });
  });

  describe('date comparison filters', () => {
    it('should check if date is today', () => {
      const today = new Date().toISOString();
      const template = env.renderString(`{{ "${today}" | isToday }}`);
      expect(template).toBe('true');
    });

    it('should check if date is before another date', () => {
      const template = env.renderString('{{ "2023-12-24" | isBefore("2023-12-25") }}');
      expect(template).toBe('true');
    });

    it('should check if date is after another date', () => {
      const template = env.renderString('{{ "2023-12-26" | isAfter("2023-12-25") }}');
      expect(template).toBe('true');
    });

    it('should calculate difference between dates', () => {
      const template = env.renderString('{{ "2023-12-30" | dateDiff("2023-12-25", "day") }}');
      expect(template).toBe('5');
    });
  });

  describe('date conversion filters', () => {
    it('should convert to Unix timestamp', () => {
      const template = env.renderString('{{ "2023-12-25T00:00:00Z" | dateUnix }}');
      expect(parseInt(template)).toBeGreaterThan(1700000000);
    });

    it('should convert to ISO string', () => {
      const template = env.renderString('{{ "2023-12-25" | dateIso }}');
      expect(template).toMatch(/2023-12-25T\d{2}:00:00\.000Z/);
    });

    it('should convert to UTC', () => {
      const template = env.renderString('{{ "2023-12-25T10:30:00" | dateUtc | formatDate("YYYY-MM-DD HH:mm:ss") }}');
      expect(template).toMatch(/2023-12-25 \d{2}:30:00/);
    });
  });

  describe('global date functions', () => {
    it('should provide now() function', () => {
      const template = env.renderString('{{ now() | formatDate("YYYY-MM-DD") }}');
      const today = new Date().toISOString().slice(0, 10);
      expect(template).toBe(today);
    });

    it('should provide today() function', () => {
      const template = env.renderString('{{ today() | formatDate("YYYY-MM-DD") }}');
      const today = new Date().toISOString().slice(0, 10);
      expect(template).toBe(today);
    });

    it('should provide timestamp() function for backwards compatibility', () => {
      const template = env.renderString('{{ timestamp() }}');
      expect(template).toMatch(/^\d{14}$/);
    });

    it('should provide enhanced formatDate() global', () => {
      const template = env.renderString('{{ formatDate("2023-12-25", "YYYY/MM/DD") }}');
      expect(template).toBe('2023/12/25');
    });
  });

  describe('template usage examples', () => {
    it('should work in frontmatter-style usage', () => {
      const template = env.renderString('migrations/{{ timestamp() | formatDate("YYYY_MM_DD_HHmmss") }}_create_users.sql');
      expect(template).toMatch(/migrations\/\d{4}_\d{2}_\d{2}_\d{6}_create_users\.sql/);
    });

    it('should work for future dates', () => {
      const template = env.renderString('created: {{ now() | dateAdd(1, "day") | formatDate("YYYY-MM-DD") }}');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expectedDate = tomorrow.toISOString().slice(0, 10);
      expect(template).toBe(`created: ${expectedDate}`);
    });

    it('should work with complex date manipulations', () => {
      const template = env.renderString(
        '{{ "2023-01-01" | dateAdd(6, "month") | dateStart("month") | formatDate("YYYY-MM-DD") }}'
      );
      expect(template).toBe('2023-07-01');
    });
  });

  describe('error handling', () => {
    it('should handle null/undefined dates', () => {
      expect(env.renderString('{{ null | formatDate }}')).toBe('');
      expect(env.renderString('{{ undefined | formatDate }}')).toBe('');
    });

    it('should handle invalid date operations', () => {
      expect(env.renderString('{{ "invalid" | dateAdd(1, "day") }}')).toBe('');
      expect(env.renderString('{{ "invalid" | isToday }}')).toBe('false');
    });

    it('should provide fallbacks for timezone operations', () => {
      expect(env.renderString('{{ "2023-12-25" | dateTimezone("Invalid/Timezone") }}')).toBe('');
    });
  });
});