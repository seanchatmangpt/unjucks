/**
 * Utility Filters Test Suite (10+ filters)
 * Testing common utility filters like dump, join, default, etc.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../../src/lib/nunjucks-filters.js';

describe('Utility Filters (10+ filters)', () => {
  let env;

  beforeAll(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('Data Formatting Utilities', () => {
    it('should dump objects as JSON', () => {
      const obj = { name: 'John', age: 30, active: true };
      const expected = JSON.stringify(obj, null, 2);
      const result = env.renderString(`{{ obj | dump }}`, { obj });
      expect(result).toBe(expected);
    });

    it('should dump complex nested objects', () => {
      const complex = {
        user: {
          profile: {
            name: 'John Doe',
            contacts: ['email@example.com', '+1234567890'],
            preferences: {
              theme: 'dark',
              notifications: true
            }
          }
        },
        metadata: {
          created: new Date('2024-01-15'),
          updated: null
        }
      };
      
      const result = env.renderString(`{{ complex | dump }}`, { complex });
      const parsed = JSON.parse(result);
      expect(parsed.user.profile.name).toBe('John Doe');
      expect(parsed.user.profile.contacts).toEqual(['email@example.com', '+1234567890']);
    });

    it('should dump arrays correctly', () => {
      const arr = [1, 'two', { three: 3 }, [4, 5], null];
      const result = env.renderString(`{{ arr | dump }}`, { arr });
      const parsed = JSON.parse(result);
      expect(parsed).toEqual([1, 'two', { three: 3 }, [4, 5], null]);
    });
  });

  describe('Array and String Joining', () => {
    it('should join arrays with default separator', () => {
      const arr = ['apple', 'banana', 'cherry'];
      const result = env.renderString(`{{ arr | join }}`, { arr });
      expect(result).toBe('applebananacherry');
    });

    it('should join arrays with custom separator', () => {
      const arr = ['apple', 'banana', 'cherry'];
      expect(env.renderString(`{{ arr | join(", ") }}`, { arr })).toBe('apple, banana, cherry');
      expect(env.renderString(`{{ arr | join(" | ") }}`, { arr })).toBe('apple | banana | cherry');
      expect(env.renderString(`{{ arr | join("-") }}`, { arr })).toBe('apple-banana-cherry');
    });

    it('should handle various data types in arrays', () => {
      const mixed = [1, 'text', true, null, undefined];
      const result = env.renderString(`{{ mixed | join(", ") }}`, { mixed });
      expect(result).toBe('1, text, true, , ');
    });

    it('should handle non-array values gracefully', () => {
      expect(env.renderString(`{{ "not-array" | join(", ") }}`)).toBe('not-array');
      expect(env.renderString(`{{ 123 | join("-") }}`)).toBe('123');
      expect(env.renderString(`{{ null | join(",") }}`)).toBe('');
    });

    it('should join empty arrays', () => {
      const empty = [];
      const result = env.renderString(`{{ empty | join(", ") }}`, { empty });
      expect(result).toBe('');
    });
  });

  describe('Default Value Handling', () => {
    it('should provide default values for falsy inputs', () => {
      expect(env.renderString(`{{ null | default("N/A") }}`)).toBe('N/A');
      expect(env.renderString(`{{ undefined | default("Not Set") }}`)).toBe('Not Set');
      expect(env.renderString(`{{ "" | default("Empty") }}`)).toBe('Empty');
      expect(env.renderString(`{{ 0 | default("Zero") }}`)).toBe('Zero');
      expect(env.renderString(`{{ false | default("False") }}`)).toBe('False');
    });

    it('should return original value for truthy inputs', () => {
      expect(env.renderString(`{{ "Hello" | default("N/A") }}`)).toBe('Hello');
      expect(env.renderString(`{{ 42 | default("Zero") }}`)).toBe('42');
      expect(env.renderString(`{{ true | default("False") }}`)).toBe('true');
      expect(env.renderString(`{{ [1,2,3] | default("Empty") | join(",") }}`)).toBe('1,2,3');
    });

    it('should handle object and array defaults', () => {
      const obj = { name: 'John' };
      const defaultObj = { name: 'Anonymous' };
      
      const result1 = env.renderString(`{{ existing | default(defaultVal) | dump }}`, { 
        existing: obj, 
        defaultVal: defaultObj 
      });
      expect(JSON.parse(result1).name).toBe('John');
      
      const result2 = env.renderString(`{{ missing | default(defaultVal) | dump }}`, { 
        defaultVal: defaultObj 
      });
      expect(JSON.parse(result2).name).toBe('Anonymous');
    });
  });

  describe('Case Conversion Utilities', () => {
    it('should convert to lower case', () => {
      expect(env.renderString(`{{ "HELLO WORLD" | lower }}`)).toBe('hello world');
      expect(env.renderString(`{{ "MixedCase" | lowerCase }}`)).toBe('mixedcase');
      expect(env.renderString(`{{ "ALL-CAPS-WITH-SYMBOLS!" | lower }}`)).toBe('all-caps-with-symbols!');
    });

    it('should convert to upper case', () => {
      expect(env.renderString(`{{ "hello world" | upper }}`)).toBe('HELLO WORLD');
      expect(env.renderString(`{{ "mixedCase" | upperCase }}`)).toBe('MIXEDCASE');
      expect(env.renderString(`{{ "lower-with-symbols!" | upper }}`)).toBe('LOWER-WITH-SYMBOLS!');
    });

    it('should capitalize first letter', () => {
      expect(env.renderString(`{{ "hello world" | capitalize }}`)).toBe('Hello world');
      expect(env.renderString(`{{ "UPPERCASE" | capitalize }}`)).toBe('Uppercase');
      expect(env.renderString(`{{ "mixedCASE" | capitalize }}`)).toBe('Mixedcase');
    });

    it('should handle empty and null values in case conversion', () => {
      expect(env.renderString(`{{ "" | upper }}`)).toBe('');
      expect(env.renderString(`{{ null | lower }}`)).toBe('');
      expect(env.renderString(`{{ undefined | capitalize }}`)).toBe('');
    });
  });

  describe('Global Utility Functions', () => {
    it('should provide timestamp global function', () => {
      const timestamp = env.renderString(`{{ timestamp() }}`);
      expect(timestamp).toMatch(/^\d{14}$/); // YYYYMMDDHHMMSS format
      expect(timestamp.length).toBe(14);
      
      // Should be current timestamp (within reasonable range)
      const year = timestamp.substring(0, 4);
      expect(parseInt(year)).toBeGreaterThanOrEqual(2024);
    });

    it('should provide now global function', () => {
      const now = env.renderString(`{{ now().format("YYYY-MM-DD") }}`);
      expect(now).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Should be current date
      const currentYear = new Date().getFullYear();
      expect(now.startsWith(currentYear.toString())).toBe(true);
    });

    it('should provide today global function', () => {
      const today = env.renderString(`{{ today().format("YYYY-MM-DD HH:mm:ss") }}`);
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/);
    });

    it('should provide formatDate global function', () => {
      const formatted1 = env.renderString(`{{ formatDate(new Date("2024-01-15"), "YYYY-MM-DD") }}`);
      expect(formatted1).toBe('2024-01-15');
      
      const formatted2 = env.renderString(`{{ formatDate(new Date("2024-01-15"), "MMM Do, YYYY") }}`);
      expect(formatted2).toBe('Jan 15th, 2024');
    });

    it('should expose dayjs global for advanced usage', () => {
      const advanced = env.renderString(`{{ dayjs("2024-01-15").add(7, "day").format("YYYY-MM-DD") }}`);
      expect(advanced).toBe('2024-01-22');
      
      const relative = env.renderString(`{{ dayjs("2024-01-01").from(dayjs("2024-01-15")) }}`);
      expect(relative).toContain('14 days ago');
    });
  });

  describe('Filter Chaining with Utilities', () => {
    it('should chain utility filters effectively', () => {
      const data = { items: ['apple', 'banana', null, 'cherry'] };
      const result = env.renderString(`{{ items | join(", ") | default("No items") | upper }}`, data);
      expect(result).toBe('APPLE, BANANA, , CHERRY');
    });

    it('should combine with data formatting', () => {
      const user = { 
        name: 'john doe',
        email: 'JOHN@EXAMPLE.COM',
        skills: ['javascript', 'python', 'go']
      };
      
      const template = `
        Name: {{ name | capitalize }}
        Email: {{ email | lower }}
        Skills: {{ skills | join(", ") | titleCase }}
        Profile: {{ user | dump }}
      `;
      
      const result = env.renderString(template, { ...user, user });
      expect(result).toContain('Name: John doe');
      expect(result).toContain('Email: john@example.com');
      expect(result).toContain('Skills: Javascript, Python, Go');
      expect(result).toContain('"name": "john doe"');
    });

    it('should handle complex default scenarios', () => {
      const template = `
        {{ missing_array | default([]) | join(", ") | default("No items") }}
        {{ empty_string | default("fallback") | upper }}
        {{ zero_value | default(42) | fakeNumber(1, 100) }}
      `;
      
      const result = env.renderString(template, {
        empty_string: '',
        zero_value: 0
      });
      
      expect(result).toContain('No items');
      expect(result).toContain('FALLBACK');
    });
  });

  describe('Type Handling', () => {
    it('should handle different input types correctly', () => {
      const testData = {
        string: 'hello',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { key: 'value' },
        nullValue: null,
        undefinedValue: undefined
      };
      
      // Test dump with different types
      expect(() => env.renderString(`{{ string | dump }}`, testData)).not.toThrow();
      expect(() => env.renderString(`{{ number | dump }}`, testData)).not.toThrow();
      expect(() => env.renderString(`{{ boolean | dump }}`, testData)).not.toThrow();
      expect(() => env.renderString(`{{ array | dump }}`, testData)).not.toThrow();
      expect(() => env.renderString(`{{ object | dump }}`, testData)).not.toThrow();
      
      // Test join with different types
      expect(env.renderString(`{{ string | join("-") }}`, testData)).toBe('hello');
      expect(env.renderString(`{{ number | join("-") }}`, testData)).toBe('42');
      
      // Test default with different types
      expect(env.renderString(`{{ nullValue | default("NULL") }}`, testData)).toBe('NULL');
      expect(env.renderString(`{{ undefinedValue | default("UNDEFINED") }}`, testData)).toBe('UNDEFINED');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle circular references in dump', () => {
      const circular = { name: 'test' };
      circular.self = circular;
      
      expect(() => {
        env.renderString(`{{ circular | dump }}`, { circular });
      }).toThrow(); // JSON.stringify should throw on circular references
    });

    it('should handle very large arrays in join', () => {
      const largeArray = new Array(1000).fill('item');
      const result = env.renderString(`{{ largeArray | join(",") }}`, { largeArray });
      expect(result.split(',').length).toBe(1000);
      expect(result.startsWith('item,item,item')).toBe(true);
    });

    it('should handle special characters in join', () => {
      const specialChars = ['<', '>', '&', '"', "'", '\n', '\t'];
      const result = env.renderString(`{{ specialChars | join("|") }}`, { specialChars });
      expect(result).toBe('<|>|&|"|\'|\n|\t');
    });

    it('should handle Unicode in case conversions', () => {
      expect(env.renderString(`{{ "café résumé" | upper }}`)).toBe('CAFÉ RÉSUMÉ');
      expect(env.renderString(`{{ "NAÏVE FAÇADE" | lower }}`)).toBe('naïve façade');
      expect(env.renderString(`{{ "πάνδα" | capitalize }}`)).toBe('Πάνδα');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large data dumps efficiently', () => {
      const largeObject = {
        users: new Array(100).fill(0).map((_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          active: i % 2 === 0
        }))
      };
      
      const start = Date.now();
      env.renderString(`{{ data | dump }}`, { data: largeObject });
      const end = Date.now();
      
      expect(end - start).toBeLessThan(100); // Should be fast
    });

    it('should handle bulk utility operations efficiently', () => {
      const start = Date.now();
      
      for (let i = 0; i < 200; i++) {
        env.renderString(`
          {{ items | join(", ") | default("none") | upper }}
          {{ value | default(fallback) | lower }}
        `, {
          items: [`item${i}`, `value${i}`],
          value: `Test${i}`,
          fallback: 'default'
        });
      }
      
      const end = Date.now();
      expect(end - start).toBeLessThan(1000);
    });
  });

  describe('Practical Usage Scenarios', () => {
    it('should work well in configuration templates', () => {
      const config = {
        database: {
          host: 'localhost',
          port: 5432,
          name: 'myapp',
          credentials: null
        },
        features: ['auth', 'caching', 'logging'],
        debug: true
      };
      
      const template = `
        database_url={{ database.host | default("127.0.0.1") }}:{{ database.port | default(5432) }}/{{ database.name }}
        features={{ features | join(",") | upper }}
        debug_mode={{ debug | default(false) }}
        credentials={{ database.credentials | default("none") }}
        config_dump={{ config | dump }}
      `;
      
      const result = env.renderString(template, { ...config, config });
      expect(result).toContain('database_url=localhost:5432/myapp');
      expect(result).toContain('features=AUTH,CACHING,LOGGING');
      expect(result).toContain('debug_mode=true');
      expect(result).toContain('credentials=none');
    });

    it('should work well for data transformation pipelines', () => {
      const rawData = [
        { name: 'john doe', status: null, tags: ['admin', 'user'] },
        { name: 'JANE SMITH', status: 'active', tags: [] },
        { name: '', status: 'inactive', tags: ['guest'] }
      ];
      
      const template = `
        {% for user in users %}
        User: {{ user.name | default("Anonymous") | titleCase }}
        Status: {{ user.status | default("unknown") | upper }}
        Tags: {{ user.tags | join(", ") | default("none") }}
        Data: {{ user | dump }}
        ---
        {% endfor %}
      `;
      
      const result = env.renderString(template, { users: rawData });
      expect(result).toContain('User: John Doe');
      expect(result).toContain('User: Jane Smith');
      expect(result).toContain('User: Anonymous');
      expect(result).toContain('Status: UNKNOWN');
      expect(result).toContain('Status: ACTIVE');
      expect(result).toContain('Tags: admin, user');
      expect(result).toContain('Tags: none');
    });
  });
});