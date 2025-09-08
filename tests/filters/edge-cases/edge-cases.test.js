/**
 * Edge Cases and Stress Testing for All Filter Categories
 * Testing boundary conditions, error handling, and extreme inputs
 */

import { describe, it, expect, beforeAll } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../../src/lib/nunjucks-filters.js';

describe('Edge Cases and Stress Testing', () => {
  let env;

  beforeAll(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
  });

  describe('Unicode and International Character Support', () => {
    it('should handle various Unicode characters in string filters', () => {
      const unicodeStrings = [
        'café_résumé', // Latin extended
        '北京_天津', // Chinese
        'московский_университет', // Cyrillic
        'αλφάβητο_ελληνικό', // Greek
        'مرحبا_بالعالم', // Arabic
        'שלום_עולם', // Hebrew
        '🚀_emoji_test', // Emoji
        'naïve_façade' // Accented characters
      ];

      unicodeStrings.forEach(str => {
        expect(() => {
          const result = env.renderString(`{{ "${str}" | camelCase }}`, {});
          expect(result).toBeTruthy();
        }).not.toThrow();
      });
    });

    it('should handle Unicode in RDF literals', () => {
      const unicodeData = [
        { text: 'مرحبا', lang: 'ar' },
        { text: '你好', lang: 'zh' },
        { text: 'Здравствуйте', lang: 'ru' },
        { text: 'Γεια σας', lang: 'el' }
      ];

      unicodeData.forEach(({ text, lang }) => {
        const result = env.renderString(`{{ "${text}" | rdfLiteral("${lang}") }}`);
        expect(result).toBe(`"${text}"@${lang}`);
      });
    });

    it('should handle emoji and special characters', () => {
      const specialChars = '🚀💯✨🎉🔥';
      const result = env.renderString(`{{ "${specialChars}" | reverse }}`);
      expect(result).toBe('🔥🎉✨💯🚀');
    });
  });

  describe('Null, Undefined, and Empty Value Handling', () => {
    it('should handle null values across all filter categories', () => {
      const nullTests = [
        { filter: 'pascalCase', expected: '' },
        { filter: 'formatDate', expected: '' },
        { filter: 'rdfResource', expected: '' },
        { filter: 'fakeName', expected: 'John Doe' }, // Fallback
        { filter: 'dump', expected: 'null' }
      ];

      nullTests.forEach(({ filter, expected }) => {
        const result = env.renderString(`{{ null | ${filter} }}`);
        expect(result).toBe(expected);
      });
    });

    it('should handle undefined values gracefully', () => {
      const undefinedTests = [
        'pascalCase',
        'formatDate', 
        'rdfResource',
        'sparqlVar',
        'join',
        'default'
      ];

      undefinedTests.forEach(filter => {
        expect(() => {
          env.renderString(`{{ undefined | ${filter} }}`);
        }).not.toThrow();
      });
    });

    it('should handle empty arrays and objects', () => {
      expect(env.renderString('{{ [] | join(",") }}')).toBe('');
      expect(env.renderString('{{ [] | rdfList }}')).toBe('rdf:nil');
      expect(env.renderString('{{ {} | dump }}')).toBe('{}');
      expect(env.renderString('{{ [] | default("empty") }}')).toBe('empty');
    });

    it('should handle deeply nested null structures', () => {
      const nested = {
        user: {
          profile: {
            name: null,
            contacts: {
              email: null,
              phone: undefined
            }
          }
        }
      };

      const template = `
        Name: {{ user.profile.name | default("Unknown") | titleCase }}
        Email: {{ user.profile.contacts.email | default("no-email@example.com") | lower }}
        Phone: {{ user.profile.contacts.phone | default("N/A") }}
      `;

      const result = env.renderString(template, nested);
      expect(result).toContain('Name: Unknown');
      expect(result).toContain('Email: no-email@example.com');
      expect(result).toContain('Phone: N/A');
    });
  });

  describe('Large Data Processing', () => {
    it('should handle very large strings', () => {
      const largeString = 'A'.repeat(10000);
      const start = Date.now();
      
      const result = env.renderString(`{{ largeString | camelCase | truncate(50) }}`, { largeString });
      
      const end = Date.now();
      expect(result.length).toBeLessThanOrEqual(50);
      expect(end - start).toBeLessThan(1000); // Should process quickly
    });

    it('should handle large arrays efficiently', () => {
      const largeArray = new Array(1000).fill(0).map((_, i) => `item_${i}`);
      const start = Date.now();
      
      const result = env.renderString('{{ largeArray | join(",") | truncate(100) }}', { largeArray });
      
      const end = Date.now();
      expect(result).toBeTruthy();
      expect(end - start).toBeLessThan(500);
    });

    it('should handle deeply nested object dumps', () => {
      const deepObject = {};
      let current = deepObject;
      
      // Create 10 levels deep
      for (let i = 0; i < 10; i++) {
        current.level = i;
        current.data = `level_${i}_data`;
        current.nested = {};
        current = current.nested;
      }

      expect(() => {
        env.renderString('{{ deepObject | dump }}', { deepObject });
      }).not.toThrow();
    });
  });

  describe('Extreme Date Values', () => {
    it('should handle edge date values', () => {
      const extremeDates = [
        '1970-01-01T00:00:00Z', // Unix epoch
        '2038-01-19T03:14:07Z', // 32-bit timestamp limit
        '1900-01-01T00:00:00Z', // Very old date
        '2100-12-31T23:59:59Z', // Far future
        '2024-02-29T12:00:00Z', // Leap year
        '2023-02-28T23:59:59Z' // Non-leap year
      ];

      extremeDates.forEach(date => {
        expect(() => {
          const result = env.renderString(`{{ "${date}" | formatDate("YYYY-MM-DD") }}`);
          expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }).not.toThrow();
      });
    });

    it('should handle invalid date strings', () => {
      const invalidDates = [
        'not-a-date',
        '2024-13-45', // Invalid month/day
        '2024-02-30', // Invalid leap year date
        '', // Empty string
        'Mon Feb 30 2024', // Invalid date text
        '2024/13/01' // Wrong format
      ];

      invalidDates.forEach(date => {
        const result = env.renderString(`{{ "${date}" | formatDate }}`);
        expect(result).toBe(''); // Should return empty string for invalid dates
      });
    });

    it('should handle timezone edge cases', () => {
      const timezones = [
        'UTC',
        'America/New_York',
        'Asia/Tokyo',
        'Australia/Sydney',
        'Europe/London',
        'Invalid/Timezone' // Should handle gracefully
      ];

      const testDate = '2024-01-15T12:00:00Z';
      timezones.forEach(tz => {
        const result = env.renderString(`{{ "${testDate}" | dateTimezone("${tz}") }}`);
        // Should either return a valid date or null for invalid timezone
        expect(['null', null].includes(result) || result.match(/\d{4}/)).toBeTruthy();
      });
    });
  });

  describe('Special Characters and Escaping', () => {
    it('should handle Turtle escaping edge cases', () => {
      const specialChars = [
        'Line 1\nLine 2',
        'Tab\there',
        'Quote: "Hello"',
        'Backslash: \\test\\',
        'Carriage\rReturn',
        'Mixed: "test"\n\tvalue\\here'
      ];

      specialChars.forEach(str => {
        const result = env.renderString(`{{ "${str}" | turtleEscape }}`);
        expect(result).toBeTruthy();
        expect(result).not.toBe(str); // Should be escaped
      });
    });

    it('should handle HTML/XML characters in filters', () => {
      const htmlChars = '<script>alert("xss")</script>';
      const result = env.renderString(`{{ "${htmlChars}" | slug }}`);
      expect(result).toBe('scriptalertxssscript'); // Should remove special chars
    });

    it('should handle SQL injection attempts in filters', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const result = env.renderString(`{{ "${sqlInjection}" | turtleEscape }}`);
      expect(result).toContain('\\"'); // Should be escaped
    });
  });

  describe('Memory and Resource Limits', () => {
    it('should handle memory efficiently with repeated operations', () => {
      const iterations = 1000;
      const start = Date.now();
      let results = [];

      for (let i = 0; i < iterations; i++) {
        const result = env.renderString(`
          {{ "test_${i}" | camelCase }}
          {{ "${i}" | rdfDatatype("integer") }}
          {{ fakeNumber(1, 100) }}
        `.replace('${i}', i));
        results.push(result);
      }

      const end = Date.now();
      expect(results.length).toBe(iterations);
      expect(end - start).toBeLessThan(5000); // Should complete in reasonable time
      
      // Clear results to free memory
      results = null;
    });

    it('should handle concurrent filter operations', async () => {
      const concurrentOps = Array(10).fill(0).map((_, i) => 
        new Promise(resolve => {
          setTimeout(() => {
            const result = env.renderString(`
              {{ "item_${i}" | pascalCase | rdfResource | curie | default("ex:Item") }}
            `.replace('${i}', i));
            resolve(result);
          }, Math.random() * 10);
        })
      );

      const results = await Promise.all(concurrentOps);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeTruthy();
      });
    });
  });

  describe('Filter Parameter Edge Cases', () => {
    it('should handle invalid parameters gracefully', () => {
      const invalidParamTests = [
        { template: '{{ "test" | truncate(-1) }}', shouldError: false },
        { template: '{{ "test" | repeat(-1) }}', shouldError: false },
        { template: '{{ "test" | pad(-1) }}', shouldError: false },
        { template: '{{ [] | fakeArrayElement }}', shouldError: false },
        { template: '{{ "test" | dateAdd("invalid", "day") }}', shouldError: false }
      ];

      invalidParamTests.forEach(({ template, shouldError }) => {
        if (shouldError) {
          expect(() => env.renderString(template)).toThrow();
        } else {
          expect(() => env.renderString(template)).not.toThrow();
        }
      });
    });

    it('should handle extreme numeric parameters', () => {
      const extremeNumbers = [
        { num: Number.MAX_SAFE_INTEGER, filter: 'fakeNumber' },
        { num: 0, filter: 'repeat' },
        { num: -100, filter: 'truncate' },
        { num: 1.5, filter: 'repeat' } // Non-integer
      ];

      extremeNumbers.forEach(({ num, filter }) => {
        expect(() => {
          env.renderString(`{{ "test" | ${filter}(${num}) }}`);
        }).not.toThrow();
      });
    });
  });

  describe('Cross-Filter Compatibility', () => {
    it('should maintain data integrity across different filter types', () => {
      const testData = {
        text: 'Hello_World',
        number: 42,
        date: '2024-01-15T10:30:00Z',
        array: ['a', 'b', 'c'],
        object: { key: 'value' }
      };

      const template = `
        Text Chain: {{ text | camelCase | rdfResource | curie | default("ex:HelloWorld") }}
        Number Chain: {{ number | rdfDatatype("integer") | turtleEscape }}
        Date Chain: {{ date | formatDate("YYYY-MM-DD") | rdfLiteral("en") }}
        Array Chain: {{ array | join(",") | upper | slug }}
        Object Chain: {{ object | dump | truncate(50) }}
      `;

      const result = env.renderString(template, testData);
      expect(result).toContain('Text Chain:');
      expect(result).toContain('Number Chain:');
      expect(result).toContain('Date Chain:');
      expect(result).toContain('Array Chain:');
      expect(result).toContain('Object Chain:');
    });

    it('should handle type conversions gracefully', () => {
      const mixedTypes = [
        { value: '123', filters: 'pascalCase | rdfDatatype("integer")' },
        { value: 'true', filters: 'capitalize | rdfDatatype("boolean")' },
        { value: '"quoted"', filters: 'turtleEscape | upper' },
        { value: new Date().toISOString(), filters: 'formatDate | rdfLiteral("en")' }
      ];

      mixedTypes.forEach(({ value, filters }) => {
        expect(() => {
          env.renderString(`{{ value | ${filters} }}`, { value });
        }).not.toThrow();
      });
    });
  });

  describe('Real-world Stress Scenarios', () => {
    it('should handle malformed JSON in dump filter', () => {
      const malformed = {
        circular: null,
        func: () => 'test',
        symbol: Symbol('test'),
        undefined: undefined,
        bigint: BigInt(123)
      };
      malformed.circular = malformed; // Create circular reference

      expect(() => {
        env.renderString('{{ malformed | dump }}', { malformed });
      }).toThrow(); // JSON.stringify should throw on circular refs
    });

    it('should handle template injection attempts', () => {
      const maliciousInputs = [
        '{{ "eval()" }}',
        '{%set x=1%}{{ x }}',
        '{{constructor.constructor("alert(1)")()}}',
        '${7*7}', // Template literal injection
        '<%= 7*7 %>' // EJS-style injection
      ];

      maliciousInputs.forEach(input => {
        const result = env.renderString(`{{ "${input}" | slug }}`);
        expect(result).not.toContain('49'); // Should not evaluate
        expect(result).not.toContain('alert');
      });
    });

    it('should maintain stability under rapid successive calls', () => {
      const rapidCalls = () => {
        for (let i = 0; i < 100; i++) {
          env.renderString(`
            {{ "rapid_test_${i}" | camelCase | rdfResource }}
            {{ fakeEmail() | lower }}
            {{ now().format("YYYY-MM-DD") }}
          `.replace('${i}', i));
        }
      };

      expect(rapidCalls).not.toThrow();
    });
  });
});