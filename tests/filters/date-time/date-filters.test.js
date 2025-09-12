/**
 * Date/Time Filters Test Suite (20+ Day.js powered filters)
 * Comprehensive testing of date formatting, manipulation, and timezone handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../../src/lib/nunjucks-filters.js';
import dayjs from 'dayjs';

describe('Date/Time Filters with Day.js (20+ filters)', () => {
  let env;
  const testDate = '2024-01-15T10:30:00Z';
  const testTimestamp = 1705315800000; // 2024-01-15T10:30:00Z

  beforeAll(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('Core Date Formatting', () => {
    it('should format dates with various patterns', () => {
      expect(env.renderString(`{{ "${testDate}" | formatDate }}`)).toBe('2024-01-15');
      expect(env.renderString(`{{ "${testDate}" | formatDate("YYYY-MM-DD HH:mm") }}`)).toBe('2024-01-15 10:30');
      expect(env.renderString(`{{ "${testDate}" | dateFormat("MMM Do, YYYY") }}`)).toBe('Jan 15th, 2024');
      expect(env.renderString(`{{ "${testDate}" | formatDate("dddd, MMMM Do YYYY") }}`)).toBe('Monday, January 15th 2024');
    });

    it('should handle various date inputs', () => {
      expect(env.renderString(`{{ ${testTimestamp} | formatDate }}`)).toBe('2024-01-15');
      expect(env.renderString(`{{ "${testDate}" | formatDate }}`)).toBe('2024-01-15');
      expect(env.renderString('{{ new Date("2024-01-15") | formatDate }}')).toBe('2024-01-15');
    });

    it('should handle invalid dates gracefully', () => {
      expect(env.renderString('{{ "invalid-date" | formatDate }}')).toBe('');
      expect(env.renderString('{{ null | formatDate }}')).toBe('');
      expect(env.renderString('{{ undefined | formatDate }}')).toBe('');
    });
  });

  describe('Date Arithmetic', () => {
    it('should add time to dates', () => {
      const result = env.renderString(`{{ "${testDate}" | dateAdd(7, "day") | formatDate }}`);
      expect(result).toBe('2024-01-22');
      
      const hourResult = env.renderString(`{{ "${testDate}" | dateAdd(5, "hour") | formatDate("YYYY-MM-DD HH:mm") }}`);
      expect(hourResult).toBe('2024-01-15 15:30');
    });

    it('should subtract time from dates', () => {
      const result = env.renderString(`{{ "${testDate}" | dateSub(3, "month") | formatDate }}`);
      expect(result).toBe('2023-10-15');
      
      const minuteResult = env.renderString(`{{ "${testDate}" | dateSubtract(30, "minute") | formatDate("YYYY-MM-DD HH:mm") }}`);
      expect(minuteResult).toBe('2024-01-15 10:00');
    });

    it('should handle various time units', () => {
      const units = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second'];
      units.forEach(unit => {
        const result = env.renderString(`{{ "${testDate}" | dateAdd(1, "${unit}") }}`);
        expect(result).toBeDefined();
      });
    });
  });

  describe('Relative Time', () => {
    it('should calculate relative time from now', () => {
      const pastDate = dayjs().subtract(2, 'hour').toISOString();
      const result = env.renderString(`{{ "${pastDate}" | dateFrom }}`);
      expect(result).toContain('2 hours ago');
      
      const withoutSuffix = env.renderString(`{{ "${pastDate}" | fromNow(true) }}`);
      expect(withoutSuffix).toBe('2 hours');
    });

    it('should calculate relative time to future', () => {
      const futureDate = dayjs().add(3, 'day').toISOString();
      const result = env.renderString(`{{ "${futureDate}" | dateTo }}`);
      expect(result).toContain('in 3 days');
      
      const withoutPrefix = env.renderString(`{{ "${futureDate}" | toNow(true) }}`);
      expect(withoutPrefix).toBe('3 days');
    });
  });

  describe('Start/End of Time Periods', () => {
    it('should get start of time periods', () => {
      const dayStart = env.renderString(`{{ "${testDate}" | dateStart("day") | formatDate("YYYY-MM-DD HH:mm:ss") }}`);
      expect(dayStart).toBe('2024-01-15 00:00:00');
      
      const monthStart = env.renderString(`{{ "${testDate}" | startOf("month") | formatDate("YYYY-MM-DD") }}`);
      expect(monthStart).toBe('2024-01-01');
    });

    it('should get end of time periods', () => {
      const dayEnd = env.renderString(`{{ "${testDate}" | dateEnd("day") | formatDate("YYYY-MM-DD HH:mm:ss") }}`);
      expect(dayEnd).toBe('2024-01-15 23:59:59');
      
      const monthEnd = env.renderString(`{{ "${testDate}" | endOf("month") | formatDate("YYYY-MM-DD") }}`);
      expect(monthEnd).toBe('2024-01-31');
    });

    it('should handle various time periods', () => {
      const periods = ['year', 'month', 'week', 'day', 'hour', 'minute'];
      periods.forEach(period => {
        const start = env.renderString(`{{ "${testDate}" | dateStart("${period}") }}`);
        const end = env.renderString(`{{ "${testDate}" | dateEnd("${period}") }}`);
        expect(start).toBeDefined();
        expect(end).toBeDefined();
      });
    });
  });

  describe('Date Comparisons', () => {
    it('should check if date is today', () => {
      const today = dayjs().toISOString();
      const yesterday = dayjs().subtract(1, 'day').toISOString();
      
      expect(env.renderString(`{{ "${today}" | isToday }}`)).toBe('true');
      expect(env.renderString(`{{ "${yesterday}" | isToday }}`)).toBe('false');
    });

    it('should compare dates with isBefore', () => {
      const earlier = '2024-01-01T00:00:00Z';
      const later = '2024-01-15T00:00:00Z';
      
      expect(env.renderString(`{{ "${earlier}" | isBefore("${later}") }}`)).toBe('true');
      expect(env.renderString(`{{ "${later}" | isBefore("${earlier}") }}`)).toBe('false');
    });

    it('should compare dates with isAfter', () => {
      const earlier = '2024-01-01T00:00:00Z';
      const later = '2024-01-15T00:00:00Z';
      
      expect(env.renderString(`{{ "${later}" | isAfter("${earlier}") }}`)).toBe('true');
      expect(env.renderString(`{{ "${earlier}" | isAfter("${later}") }}`)).toBe('false');
    });

    it('should calculate date differences', () => {
      const date1 = '2024-01-01T00:00:00Z';
      const date2 = '2024-01-15T00:00:00Z';
      
      const dayDiff = env.renderString(`{{ "${date2}" | dateDiff("${date1}", "day") }}`);
      expect(dayDiff).toBe('14');
      
      const hourDiff = env.renderString(`{{ "${date2}" | diff("${date1}", "hour") }}`);
      expect(hourDiff).toBe('336');
    });
  });

  describe('Date Conversions', () => {
    it('should convert to Unix timestamp', () => {
      const unixResult = env.renderString(`{{ "${testDate}" | dateUnix }}`);
      expect(parseInt(unixResult)).toBe(Math.floor(testTimestamp / 1000));
      
      const aliasResult = env.renderString(`{{ "${testDate}" | unix }}`);
      expect(aliasResult).toBe(unixResult);
    });

    it('should convert to ISO string', () => {
      const isoResult = env.renderString(`{{ "${testDate}" | dateIso }}`);
      expect(isoResult).toBe(testDate);
      
      const aliasResult = env.renderString(`{{ "${testDate}" | iso }}`);
      expect(aliasResult).toBe(isoResult);
    });

    it('should convert to UTC', () => {
      const utcResult = env.renderString(`{{ "${testDate}" | dateUtc | formatDate("YYYY-MM-DD HH:mm") }}`);
      expect(utcResult).toBe('2024-01-15 10:30');
      
      const aliasResult = env.renderString(`{{ "${testDate}" | utc | formatDate("YYYY-MM-DD HH:mm") }}`);
      expect(aliasResult).toBe(utcResult);
    });

    it('should convert to different timezones', () => {
      const nyResult = env.renderString(`{{ "${testDate}" | dateTimezone("America/New_York") | formatDate("YYYY-MM-DD HH:mm") }}`);
      expect(nyResult).toBe('2024-01-15 05:30'); // EST is UTC-5
      
      const aliasResult = env.renderString(`{{ "${testDate}" | tz("America/New_York") | formatDate("YYYY-MM-DD HH:mm") }}`);
      expect(aliasResult).toBe(nyResult);
    });
  });

  describe('Global Date Functions', () => {
    it('should provide timestamp global', () => {
      const timestamp = env.renderString('{{ timestamp() }}');
      expect(timestamp).toMatch(/^\d{14}$/); // YYYYMMDDHHMMSS format
    });

    it('should provide now global', () => {
      const now = env.renderString('{{ now().format("YYYY-MM-DD") }}');
      expect(now).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should provide today global', () => {
      const today = env.renderString('{{ today().format("YYYY-MM-DD") }}');
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should provide formatDate global', () => {
      const formatted = env.renderString('{{ formatDate(new Date("2024-01-15"), "MMM DD") }}');
      expect(formatted).toBe('Jan 15');
    });

    it('should expose dayjs global for advanced usage', () => {
      const advanced = env.renderString('{{ dayjs("2024-01-15").add(1, "week").format("YYYY-MM-DD") }}');
      expect(advanced).toBe('2024-01-22');
    });
  });

  describe('Timezone Support', () => {
    it('should handle common timezones', () => {
      const timezones = [
        'America/New_York',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Paris',
        'Asia/Tokyo',
        'Australia/Sydney'
      ];
      
      timezones.forEach(tz => {
        const result = env.renderString(`{{ "${testDate}" | dateTimezone("${tz}") | formatDate }}`);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should handle invalid timezones gracefully', () => {
      const result = env.renderString(`{{ "${testDate}" | dateTimezone("Invalid/Timezone") }}`);
      expect(result).toBe('null');
    });
  });

  describe('Advanced Formatting', () => {
    it('should support custom formats', () => {
      const formats = [
        'YYYY-MM-DD',
        'MM/DD/YYYY',
        'DD.MM.YYYY',
        'MMMM Do, YYYY',
        'dddd, MMMM Do YYYY, h:mm:ss a',
        'YYYY-MM-DDTHH:mm:ssZ'
      ];
      
      formats.forEach(format => {
        const result = env.renderString(`{{ "${testDate}" | formatDate("${format}") }}`);
        expect(result).toBeTruthy();
        expect(result).not.toBe('');
      });
    });

    it('should support locale-specific formatting', () => {
      const localeFormats = [
        'LL', // Month name, day of month, year
        'LLL', // Month name, day of month, year, time
        'LLLL', // Day of week, month name, day of month, year, time
        'LT', // Time
        'LTS' // Time with seconds
      ];
      
      localeFormats.forEach(format => {
        const result = env.renderString(`{{ "${testDate}" | formatDate("${format}") }}`);
        expect(result).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed dates', () => {
      const malformedDates = ['not-a-date', '2024-13-45', '', null, undefined];
      
      malformedDates.forEach(date => {
        const result = env.renderString(`{{ "${date}" | formatDate }}`);
        expect(result).toBe('');
      });
    });

    it('should handle invalid operations', () => {
      expect(env.renderString(`{{ "${testDate}" | dateAdd("invalid", "day") }}`)).toBe('null');
      expect(env.renderString(`{{ "${testDate}" | dateSub(5, "invalid-unit") }}`)).toBe('null');
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk date operations efficiently', () => {
      const start = this.getDeterministicTimestamp();
      for (let i = 0; i < 1000; i++) {
        env.renderString(`{{ "${testDate}" | dateAdd(${i}, "day") | formatDate }}`);
      }
      const end = this.getDeterministicTimestamp();
      expect(end - start).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should handle complex date chains efficiently', () => {
      const template = `{{ "${testDate}" | dateAdd(7, "day") | dateStart("week") | dateEnd("day") | formatDate("YYYY-MM-DD HH:mm") }}`;
      const start = this.getDeterministicTimestamp();
      const result = env.renderString(template);
      const end = this.getDeterministicTimestamp();
      
      expect(result).toBeTruthy();
      expect(end - start).toBeLessThan(100); // Should be very fast
    });
  });
});