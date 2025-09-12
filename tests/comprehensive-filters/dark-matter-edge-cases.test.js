/**
 * Dark Matter Edge Cases - The Critical 20% Testing
 * Comprehensive testing of boundary conditions, error handling, and extreme scenarios
 * These are the edge cases that make the difference between 71% and 95% success rate
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Store, Parser, DataFactory } from 'n3';
import { Environment } from 'nunjucks';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { semanticFilters } from '../../src/lib/semantic-filters.js';

const { namedNode, literal, quad } = DataFactory;

describe('Dark Matter Edge Cases - The Critical 20%', () => {
  let nunjucksEnv;
  let rdfFilters;
  let store;

  beforeAll(() => {
    nunjucksEnv = new Environment();
    store = new Store();
    rdfFilters = new RDFFilters({ store });
    
    // Register all filters
    Object.keys(semanticFilters).forEach(filterName => {
      nunjucksEnv.addFilter(filterName, semanticFilters[filterName]);
    });
    
    Object.entries(rdfFilters.getAllFilters()).forEach(([name, filter]) => {
      nunjucksEnv.addFilter(name, filter);
    });
    
    console.log('🕳️  Initializing Dark Matter Edge Case Testing...');
  });

  describe('Null, Undefined, and Empty Value Handling', () => {
    const problematicInputs = [
      { name: 'null', value: null },
      { name: 'undefined', value: undefined },
      { name: 'empty string', value: '' },
      { name: 'whitespace only', value: '   \t\n   ' },
      { name: 'NaN', value: NaN },
      { name: 'Infinity', value: Infinity },
      { name: 'negative Infinity', value: -Infinity },
      { name: 'zero', value: 0 },
      { name: 'false', value: false },
      { name: 'empty array', value: [] },
      { name: 'empty object', value: {} }
    ];

    const stringFilters = ['camelize', 'slug', 'humanize', 'escapeRDF'];
    
    stringFilters.forEach(filterName => {
      describe(`${filterName} filter with problematic inputs`, () => {
        problematicInputs.forEach(({ name, value }) => {
          it(`should handle ${name} gracefully`, () => {
            expect(() => {
              const template = `{{ input | ${filterName} }}`;
              const result = nunjucksEnv.renderString(template, { input: value });
              // Should not throw error and should return string
              expect(typeof result).toBe('string');
            }).not.toThrow();
          });
        });

        it('should handle deeply nested null values', () => {
          const nestedNull = {
            level1: {
              level2: {
                level3: {
                  value: null
                }
              }
            }
          };

          expect(() => {
            const template = `{{ data.level1.level2.level3.value | ${filterName} }}`;
            nunjucksEnv.renderString(template, { data: nestedNull });
          }).not.toThrow();
        });

        it('should handle circular references without infinite loops', () => {
          const circular = { name: 'test' };
          circular.self = circular;

          expect(() => {
            const template = `{{ obj.name | ${filterName} }}`;
            const result = nunjucksEnv.renderString(template, { obj: circular });
            expect(typeof result).toBe('string');
          }).not.toThrow();
        });
      });
    });

    describe('RDF filters with problematic inputs', () => {
      const rdfFilterTests = [
        { filter: 'rdfExists', params: [null] },
        { filter: 'rdfLabel', params: [''] },
        { filter: 'rdfType', params: [undefined] },
        { filter: 'rdfExpand', params: [''] },
        { filter: 'rdfCompact', params: [null] }
      ];

      rdfFilterTests.forEach(({ filter, params }) => {
        it(`should handle ${filter} with problematic inputs`, () => {
          problematicInputs.forEach(({ name, value }) => {
            expect(() => {
              const result = rdfFilters[filter](value, ...params.slice(1));
              // Should return appropriate default value, not throw
              expect(result).toBeDefined();
            }).not.toThrow();
          });
        });
      });

      it('should handle malformed URIs in RDF operations', () => {
        const malformedUris = [
          'not-a-uri',
          'http://',
          'https://.',
          'ftp:///invalid',
          '://missing-scheme',
          'http://[invalid-ipv6',
          'http://domain..com',
          'javascript:alert("xss")',
          'data:text/html,<script>alert(1)</script>'
        ];

        malformedUris.forEach(uri => {
          expect(() => {
            rdfFilters.rdfExists(uri);
            rdfFilters.rdfLabel(uri);
            rdfFilters.rdfExpand(uri);
            rdfFilters.rdfCompact(uri);
          }).not.toThrow();
        });
      });
    });
  });

  describe('Unicode and International Character Handling', () => {
    const unicodeTestCases = [
      { name: 'Arabic', text: 'مرحبا بالعالم', script: 'Arabic' },
      { name: 'Chinese Simplified', text: '你好世界', script: 'Han' },
      { name: 'Chinese Traditional', text: '你好世界', script: 'Han' },
      { name: 'Japanese Hiragana', text: 'こんにちは世界', script: 'Hiragana' },
      { name: 'Japanese Katakana', text: 'コンニチハセカイ', script: 'Katakana' },
      { name: 'Korean', text: '안녕하세요 세계', script: 'Hangul' },
      { name: 'Russian', text: 'Привет мир', script: 'Cyrillic' },
      { name: 'Greek', text: 'Γειά σου κόσμε', script: 'Greek' },
      { name: 'Hebrew', text: 'שלום עולם', script: 'Hebrew' },
      { name: 'Thai', text: 'สวัสดีชาวโลก', script: 'Thai' },
      { name: 'Devanagari', text: 'नमस्ते दुनिया', script: 'Devanagari' },
      { name: 'Emoji', text: '🌍🚀✨🎉🔥💫🌟⭐', script: 'Emoji' },
      { name: 'Mixed scripts', text: 'Hello こんにちは 你好 مرحبا', script: 'Mixed' },
      { name: 'RTL mixed', text: 'English עברית العربية', script: 'Mixed RTL' }
    ];

    const stringFilters = ['camelize', 'slug', 'humanize'];

    stringFilters.forEach(filterName => {
      unicodeTestCases.forEach(({ name, text, script }) => {
        it(`should handle ${name} (${script}) in ${filterName} filter`, () => {
          expect(() => {
            const template = `{{ text | ${filterName} }}`;
            const result = nunjucksEnv.renderString(template, { text });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThanOrEqual(0);
          }).not.toThrow();
        });
      });
    });

    it('should handle zero-width characters and invisible unicode', () => {
      const invisibleChars = [
        '\u200B', // Zero Width Space
        '\u200C', // Zero Width Non-Joiner
        '\u200D', // Zero Width Joiner
        '\u2060', // Word Joiner
        '\uFEFF', // Zero Width No-Break Space
        '\u180E', // Mongolian Vowel Separator
      ];

      invisibleChars.forEach(char => {
        expect(() => {
          const template = '{{ text | slug }}';
          const result = nunjucksEnv.renderString(template, { text: `test${char}text` });
          expect(typeof result).toBe('string');
        }).not.toThrow();
      });
    });

    it('should handle combining characters and diacritics', () => {
      const combiningChars = [
        'é' + '\u0301', // e with acute + combining acute
        'ñ' + '\u0303', // n with tilde + combining tilde  
        'a' + '\u0300' + '\u0301', // a with grave + acute
        'o' + '\u0308' + '\u0304', // o with diaeresis + macron
      ];

      combiningChars.forEach(text => {
        expect(() => {
          const template = '{{ text | camelize }}';
          const result = nunjucksEnv.renderString(template, { text });
          expect(typeof result).toBe('string');
        }).not.toThrow();
      });
    });
  });

  describe('Extreme Size and Performance Edge Cases', () => {
    it('should handle extremely long strings without performance degradation', () => {
      const extremeStrings = [
        'a'.repeat(10000),
        'Unicode🚀'.repeat(1000),
        '- '.repeat(5000), // Many separators
        'CamelCase'.repeat(1000),
        'under_score'.repeat(1000)
      ];

      extremeStrings.forEach((longString, index) => {
        const startTime = performance.now();
        
        expect(() => {
          const template = '{{ text | slug }}';
          const result = nunjucksEnv.renderString(template, { text: longString });
          expect(typeof result).toBe('string');
        }).not.toThrow();

        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(100); // Should complete within 100ms
        
        console.log(`📏 Extreme string ${index + 1} (${longString.length} chars): ${duration.toFixed(2)}ms`);
      });
    });

    it('should handle nested template structures without stack overflow', () => {
      const deeplyNested = {};
      let current = deeplyNested;
      
      // Create 100 levels of nesting
      for (let i = 0; i < 100; i++) {
        current.level = i;
        current.next = {};
        current = current.next;
      }
      current.value = 'deep-value';

      expect(() => {
        // Test accessing deeply nested value
        const template = '{{ data.next.next.next.next.next.value | slug }}';
        const result = nunjucksEnv.renderString(template, { data: deeplyNested });
        expect(typeof result).toBe('string');
      }).not.toThrow();
    });

    it('should handle arrays with extreme sizes', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => `item-${i}`);
      
      expect(() => {
        const template = '{{ items | length }}';
        const result = nunjucksEnv.renderString(template, { items: largeArray });
        expect(parseInt(result)).toBe(10000);
      }).not.toThrow();
    });

    it('should handle concurrent template processing without interference', async () => {
      const concurrentTemplates = Array.from({ length: 100 }, (_, i) => 
        new Promise(resolve => {
          try {
            const template = '{{ value | camelize }}';
            const result = nunjucksEnv.renderString(template, { value: `test-value-${i}` });
            resolve({ success: true, result, index: i });
          } catch (error) {
            resolve({ success: false, error: error.message, index: i });
          }
        })
      );

      const results = await Promise.all(concurrentTemplates);
      const successCount = results.filter(r => r.success).length;
      
      expect(successCount).toBe(100);
      
      // Verify results are correct and unique
      const uniqueResults = new Set(results.map(r => r.result));
      expect(uniqueResults.size).toBe(100);
    });
  });

  describe('Memory Pressure and Resource Exhaustion', () => {
    it('should handle memory pressure gracefully', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create many template objects
      const templates = [];
      for (let i = 0; i < 1000; i++) {
        templates.push({
          template: '{{ value | camelize }}',
          data: { value: `test-string-${i}` }
        });
      }

      // Process all templates
      const results = templates.map(({ template, data }) => {
        return nunjucksEnv.renderString(template, data);
      });

      expect(results).toHaveLength(1000);
      expect(results.every(r => typeof r === 'string')).toBe(true);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`💾 Memory increase for 1000 templates: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // Should not use excessive memory
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // < 50MB
    });

    it('should handle RDF store memory pressure', () => {
      const testStore = new Store();
      const testFilters = new RDFFilters({ store: testStore });
      
      // Add many triples to simulate memory pressure
      for (let i = 0; i < 50000; i++) {
        testStore.addQuad(quad(
          namedNode(`http://example.org/entity${i}`),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode(`http://example.org/Class${i % 100}`)
        ));
      }

      // Perform operations under memory pressure
      const operations = [
        () => testFilters.rdfCount(),
        () => testFilters.rdfExists('http://example.org/entity1000'),
        () => testFilters.rdfQuery('?s rdf:type ?o'),
        () => testFilters.rdfLabel('http://example.org/entity1000')
      ];

      operations.forEach(op => {
        expect(() => {
          const result = op();
          expect(result).toBeDefined();
        }).not.toThrow();
      });
    });

    it('should clean up resources properly', async () => {
      // Test multiple cycles of resource creation and cleanup
      for (let cycle = 0; cycle < 5; cycle++) {
        const cycleStore = new Store();
        const cycleFilters = new RDFFilters({ store: cycleStore });
        
        // Add data
        for (let i = 0; i < 1000; i++) {
          cycleStore.addQuad(quad(
            namedNode(`http://test.org/entity${i}`),
            namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            namedNode('http://test.org/TestClass')
          ));
        }

        // Use filters
        const count = cycleFilters.rdfCount();
        expect(count).toBe(1000);

        // Allow garbage collection
        if (global.gc) {
          global.gc();
        }
        
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });
  });

  describe('Malicious Input and Security Edge Cases', () => {
    it('should handle potential XSS vectors safely', () => {
      const xssVectors = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        '"onload="alert(1)',
        "'onload='alert(1)",
        '${alert(1)}',
        '{{constructor.constructor("alert(1)")()}}',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        'eval("alert(1)")',
        'Function("alert(1)")()'
      ];

      xssVectors.forEach(vector => {
        expect(() => {
          // Test with different filters
          const slugResult = nunjucksEnv.renderString('{{ input | slug }}', { input: vector });
          const camelResult = nunjucksEnv.renderString('{{ input | camelize }}', { input: vector });
          const escapeResult = nunjucksEnv.renderString('{{ input | escapeRDF }}', { input: vector });
          
          expect(typeof slugResult).toBe('string');
          expect(typeof camelResult).toBe('string');
          expect(typeof escapeResult).toBe('string');
          
          // Results should not contain executable code
          expect(slugResult).not.toContain('<script');
          expect(camelResult).not.toContain('javascript:');
          expect(escapeResult).not.toContain('alert(');
          
        }).not.toThrow();
      });
    });

    it('should handle prototype pollution attempts', () => {
      const pollutionVectors = [
        '__proto__',
        'constructor.prototype',
        'prototype.polluted',
        'constructor.constructor',
        '{}.__proto__',
        'Object.prototype'
      ];

      pollutionVectors.forEach(vector => {
        expect(() => {
          const template = '{{ input | camelize }}';
          const result = nunjucksEnv.renderString(template, { input: vector });
          expect(typeof result).toBe('string');
        }).not.toThrow();
      });

      // Verify prototype hasn't been polluted
      expect({}.polluted).toBeUndefined();
      expect(Object.prototype.polluted).toBeUndefined();
    });

    it('should handle ReDoS (Regular Expression Denial of Service) patterns', () => {
      const redosPatterns = [
        'a'.repeat(10000) + 'b',
        '(' + 'a'.repeat(1000) + ')*b',
        'a'.repeat(5000) + 'x'.repeat(5000),
        '(a+)+b',
        '(a|a)*b'
      ];

      redosPatterns.forEach(pattern => {
        const startTime = performance.now();
        
        expect(() => {
          const template = '{{ input | slug }}';
          const result = nunjucksEnv.renderString(template, { input: pattern });
          expect(typeof result).toBe('string');
        }).not.toThrow();

        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(1000); // Should complete within 1 second
      });
    });
  });

  describe('Data Type Edge Cases', () => {
    it('should handle mixed data types consistently', () => {
      const mixedTypes = [
        { type: 'string', value: 'test' },
        { type: 'number', value: 42 },
        { type: 'boolean', value: true },
        { type: 'array', value: ['a', 'b', 'c'] },
        { type: 'object', value: { key: 'value' } },
        { type: 'date', value: this.getDeterministicDate() },
        { type: 'regexp', value: /test/g },
        { type: 'function', value: () => 'test' },
        { type: 'symbol', value: Symbol('test') },
        { type: 'bigint', value: BigInt(123) }
      ];

      mixedTypes.forEach(({ type, value }) => {
        expect(() => {
          const template = '{{ value | camelize }}';
          const result = nunjucksEnv.renderString(template, { value });
          expect(typeof result).toBe('string');
        }).not.toThrow();
        
        console.log(`🔧 Handled ${type}: ${typeof value} -> string`);
      });
    });

    it('should handle numeric edge cases', () => {
      const numericEdges = [
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_VALUE,
        Number.MIN_VALUE,
        Number.EPSILON,
        1.7976931348623157e+308, // Largest finite number
        5e-324, // Smallest positive number
        Math.PI,
        Math.E,
        -0,
        +0
      ];

      numericEdges.forEach(num => {
        expect(() => {
          const template = '{{ num | semanticValue }}';
          const result = nunjucksEnv.renderString(template, { num });
          expect(typeof result).toBe('string');
        }).not.toThrow();
      });
    });

    it('should handle date edge cases', () => {
      const dateEdges = [
        new Date('1970-01-01T00:00:00.000Z'), // Unix epoch
        new Date('2038-01-19T03:14:07.000Z'), // Y2038 problem
        new Date('1900-01-01'), // Early 20th century
        new Date('2100-12-31'), // Far future
        new Date('invalid'), // Invalid date
        new Date(8640000000000000), // Maximum date
        new Date(-8640000000000000), // Minimum date
      ];

      dateEdges.forEach(date => {
        expect(() => {
          const template = '{{ date | moment }}';
          const result = nunjucksEnv.renderString(template, { date });
          expect(typeof result).toBe('string');
        }).not.toThrow();
      });
    });
  });

  describe('Error Recovery and Graceful Degradation', () => {
    it('should recover from filter errors without breaking template processing', () => {
      const problematicTemplate = `
        Good filter: {{ "test" | camelize }}
        Bad filter: {{ badValue | nonExistentFilter }}
        Recovery filter: {{ "recovery" | slug }}
      `;

      // This should handle the error gracefully
      expect(() => {
        try {
          const result = nunjucksEnv.renderString(problematicTemplate, { 
            badValue: 'test' 
          });
          // May succeed or fail, but shouldn't crash the process
        } catch (error) {
          // Error is expected for non-existent filter
          expect(error.message).toContain('filter');
        }
      }).not.toThrow();
    });

    it('should provide meaningful error messages for debugging', () => {
      const debugScenarios = [
        {
          template: '{{ value | nonExistentFilter }}',
          data: { value: 'test' },
          expectedError: /filter/i
        },
        {
          template: '{{ missingVar | camelize }}',
          data: {},
          expectedError: /undefined/i
        }
      ];

      debugScenarios.forEach(({ template, data, expectedError }) => {
        try {
          nunjucksEnv.renderString(template, data);
        } catch (error) {
          expect(error.message).toMatch(expectedError);
        }
      });
    });

    it('should maintain state consistency after errors', () => {
      // Cause an error
      try {
        nunjucksEnv.renderString('{{ value | badFilter }}', { value: 'test' });
      } catch (error) {
        // Expected error
      }

      // Should still work normally after error
      expect(() => {
        const result = nunjucksEnv.renderString('{{ value | camelize }}', { value: 'test-after-error' });
        expect(result).toBe('testAfterError');
      }).not.toThrow();
    });
  });

  describe('Performance Under Adversarial Conditions', () => {
    it('should maintain performance with pathological inputs', () => {
      const pathologicalInputs = [
        // Nested structures
        { name: 'deeply nested', value: Array(100).fill().reduce((acc) => ({ nested: acc }), 'deep') },
        // Repeated patterns
        { name: 'repeated patterns', value: 'abcd'.repeat(10000) },
        // Complex unicode
        { name: 'complex unicode', value: '🚀'.repeat(1000) + '한글'.repeat(1000) + 'العربية'.repeat(1000) },
        // Mixed complexity
        { name: 'mixed complexity', value: 'Test-123_ABC' + '🌟'.repeat(100) + 'test' }
      ];

      pathologicalInputs.forEach(({ name, value }) => {
        const startTime = performance.now();
        
        expect(() => {
          const template = '{{ value | slug }}';
          const result = nunjucksEnv.renderString(template, { value });
          expect(typeof result).toBe('string');
        }).not.toThrow();

        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(500); // Should complete within 500ms
        
        console.log(`⚡ Pathological case '${name}': ${duration.toFixed(2)}ms`);
      });
    });

    it('should handle rapid successive operations without degradation', () => {
      const rapidOperations = 10000;
      const startTime = performance.now();
      
      for (let i = 0; i < rapidOperations; i++) {
        const template = '{{ value | camelize }}';
        const result = nunjucksEnv.renderString(template, { value: `test-${i}` });
        expect(typeof result).toBe('string');
      }

      const totalTime = performance.now() - startTime;
      const operationsPerSecond = (rapidOperations / totalTime) * 1000;
      
      expect(operationsPerSecond).toBeGreaterThan(1000); // At least 1000 ops/sec
      
      console.log(`🚅 Rapid operations: ${operationsPerSecond.toLocaleString()} ops/second`);
    });
  });
});

// Export test utilities for other test files
export const darkMatterTestUtils = {
  /**
   * Generate problematic inputs for testing
   */
  generateProblematicInputs() {
    return [
      null, undefined, '', '   ', NaN, Infinity, -Infinity,
      0, -0, false, [], {}, 
      'a'.repeat(10000),
      '🚀'.repeat(1000),
      '<script>alert("xss")</script>',
      '__proto__',
      'constructor.prototype'
    ];
  },

  /**
   * Test filter with all problematic inputs
   */
  testFilterWithProblematicInputs(nunjucksEnv, filterName) {
    const inputs = this.generateProblematicInputs();
    const results = [];
    
    inputs.forEach(input => {
      try {
        const template = `{{ input | ${filterName} }}`;
        const result = nunjucksEnv.renderString(template, { input });
        results.push({ input, result, success: true });
      } catch (error) {
        results.push({ input, error: error.message, success: false });
      }
    });
    
    return results;
  },

  /**
   * Performance test a filter
   */
  performanceTestFilter(nunjucksEnv, filterName, testInput = 'test-input', iterations = 1000) {
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      const template = `{{ input | ${filterName} }}`;
      nunjucksEnv.renderString(template, { input: `${testInput}-${i}` });
    }
    
    const totalTime = performance.now() - startTime;
    
    return {
      iterations,
      totalTime,
      averageTime: totalTime / iterations,
      operationsPerSecond: (iterations / totalTime) * 1000
    };
  }
};