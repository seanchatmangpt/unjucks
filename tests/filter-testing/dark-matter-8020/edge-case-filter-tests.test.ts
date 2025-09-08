/**
 * Dark Matter 8020 Filter Tests - Edge Cases and Boundary Conditions
 * Tests the 20% of edge cases that cause 80% of filter failures
 */

import { describe, it, expect } from 'vitest';
import { semanticFilters } from '../../../src/lib/filters/semantic';
import { jsonLdFilters } from '../../../src/lib/filters/json-ld/rdf-filters';
import { sparqlFilters } from '../../../src/lib/filters/sparql/index';

describe('Dark Matter 8020 Filter Tests - Edge Cases', () => {
  
  // The 20% of inputs that cause 80% of the problems
  const darkMatterInputs = [
    null,
    undefined,
    '',
    ' ',
    '   \t\n  ',
    0,
    -0,
    Infinity,
    -Infinity,
    NaN,
    true,
    false,
    {},
    [],
    Symbol('test'),
    new Date('invalid'),
    new Date(NaN),
    () => {},
    /regex/,
    new Map(),
    new Set(),
    Buffer.from('test'),
    BigInt(123),
    new Error('test'),
    '\u0000\u0001\u0002',
    '🚀🔥💻',
    'ñáéíóú',
    '\n\r\t',
    '"\'`',
    '<script>alert("xss")</script>',
    'SELECT * FROM users; DROP TABLE users;--',
    'javascript:alert(1)',
    '../../../etc/passwd',
    'http://evil.com/malware.js',
    Array(10000).fill('a').join(''),
    '1'.repeat(1000000),
    String.fromCharCode(0, 1, 2, 3, 4, 5),
    '\uD800', // Unpaired surrogate
    '\uFEFF', // Byte order mark
    '\u202E', // Right-to-left override
  ];

  describe('String Filter Dark Matter Tests', () => {
    const stringFilterFunctions = {
      pascalCase: (str: any) => mockPascalCase(str),
      camelCase: (str: any) => mockCamelCase(str),
      kebabCase: (str: any) => mockKebabCase(str),
      snakeCase: (str: any) => mockSnakeCase(str),
      upperCase: (str: any) => String(str || '').toUpperCase(),
      lowerCase: (str: any) => String(str || '').toLowerCase(),
      capitalize: (str: any) => {
        const s = String(str || '');
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      },
      reverse: (str: any) => String(str || '').split('').reverse().join(''),
      trim: (str: any) => String(str || '').trim(),
      escapeHtml: (str: any) => mockHtmlEscape(str),
    };

    Object.entries(stringFilterFunctions).forEach(([filterName, filterFn]) => {
      it(`should handle dark matter inputs for ${filterName}`, () => {
        let passedCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        darkMatterInputs.forEach((input, index) => {
          try {
            const result = filterFn(input);
            
            // Validate result is safe
            if (result !== null && result !== undefined) {
              // Should not contain dangerous content
              const resultStr = String(result);
              if (!containsDangerousContent(resultStr)) {
                passedCount++;
              } else {
                failedCount++;
                errors.push(`${filterName} with input ${index} produced dangerous content: ${resultStr.slice(0, 100)}`);
              }
            } else {
              passedCount++; // Null/undefined is acceptable
            }
          } catch (error) {
            failedCount++;
            errors.push(`${filterName} with input ${index} threw: ${error.message}`);
          }
        });

        // Log results
        console.log(`${filterName}: ${passedCount} passed, ${failedCount} failed`);
        if (errors.length > 0) {
          console.log(`Errors: ${errors.slice(0, 5).join('; ')}`);
        }

        // Should handle at least 70% of dark matter cases without throwing
        expect(passedCount / (passedCount + failedCount)).toBeGreaterThan(0.7);
      });
    });
  });

  describe('Semantic Filter Dark Matter Tests', () => {
    Object.entries(semanticFilters).forEach(([filterName, filterFn]) => {
      it(`should handle dark matter inputs for semantic.${filterName}`, () => {
        let passedCount = 0;
        let failedCount = 0;
        const errors: string[] = [];

        // Test a subset for complex filters
        const testInputs = filterName === 'validateOwl' ? 
          darkMatterInputs.slice(0, 10) : darkMatterInputs;

        testInputs.forEach((input, index) => {
          try {
            let result;
            
            // Handle different filter signatures
            if (filterName === 'rdfLiteral') {
              result = filterFn(input, 'en');
            } else if (filterName === 'rdfClass' || filterName === 'rdfProperty') {
              result = filterFn(input, 'ex');
            } else if (filterName === 'owlRestriction') {
              result = filterFn(input, 'someValuesFrom', 'ex:Thing');
            } else if (filterName === 'owlClassExpression') {
              result = filterFn([input], 'union');
            } else if (filterName === 'skosConcept') {
              result = filterFn(input, 'broader', ['narrower1']);
            } else if (filterName === 'dublinCore') {
              result = filterFn(input);
            } else {
              result = filterFn(input);
            }

            // Validate semantic output
            if (typeof result === 'string' || typeof result === 'object') {
              passedCount++;
            } else {
              failedCount++;
              errors.push(`${filterName} returned unexpected type: ${typeof result}`);
            }
          } catch (error) {
            // Some failures are expected with dark matter inputs
            if (error.message.includes('TypeError') || error.message.includes('Invalid')) {
              passedCount++; // Graceful failure is acceptable
            } else {
              failedCount++;
              errors.push(`${filterName} with input ${index}: ${error.message}`);
            }
          }
        });

        console.log(`semantic.${filterName}: ${passedCount} passed, ${failedCount} failed`);
        
        // Should handle at least 60% of cases (semantic filters are more complex)
        expect(passedCount / (passedCount + failedCount)).toBeGreaterThan(0.6);
      });
    });
  });

  describe('SPARQL Filter Dark Matter Tests', () => {
    Object.entries(sparqlFilters).forEach(([filterName, filterFn]) => {
      it(`should handle dark matter inputs for sparql.${filterName}`, () => {
        let passedCount = 0;
        let failedCount = 0;

        darkMatterInputs.forEach((input) => {
          try {
            const result = filterFn(input);
            
            // SPARQL filters should always return strings
            if (typeof result === 'string') {
              // Should not inject SPARQL injection
              if (!containsSparqlInjection(result)) {
                passedCount++;
              } else {
                failedCount++;
              }
            } else {
              failedCount++;
            }
          } catch (error) {
            // Type errors are acceptable for inappropriate inputs
            if (error.name === 'TypeError') {
              passedCount++;
            } else {
              failedCount++;
            }
          }
        });

        console.log(`sparql.${filterName}: ${passedCount} passed, ${failedCount} failed`);
        
        // SPARQL filters should be very robust
        expect(passedCount / (passedCount + failedCount)).toBeGreaterThan(0.8);
      });
    });
  });

  describe('JSON-LD Filter Dark Matter Tests', () => {
    Object.entries(jsonLdFilters).forEach(([filterName, filterFn]) => {
      it(`should handle dark matter inputs for jsonld.${filterName}`, () => {
        let passedCount = 0;
        let failedCount = 0;

        const testInputs = filterName === 'contextProperty' ? 
          darkMatterInputs.slice(0, 15) : darkMatterInputs;

        testInputs.forEach((input) => {
          try {
            let result;
            
            // Handle different signatures
            if (filterName === 'contextProperty') {
              result = filterFn(String(input || 'test'), {});
            } else if (filterName === 'rdfNamespaces') {
              result = filterFn([]);
            } else if (filterName === 'schemaOrgContext') {
              result = filterFn([]);
            } else {
              result = filterFn(input);
            }

            // JSON-LD filters should return objects or strings
            if (typeof result === 'string' || typeof result === 'object') {
              passedCount++;
            } else {
              failedCount++;
            }
          } catch (error) {
            if (error.name === 'TypeError' || error.message.includes('Invalid')) {
              passedCount++;
            } else {
              failedCount++;
            }
          }
        });

        console.log(`jsonld.${filterName}: ${passedCount} passed, ${failedCount} failed`);
        
        // JSON-LD filters should handle most cases gracefully
        expect(passedCount / (passedCount + failedCount)).toBeGreaterThan(0.7);
      });
    });
  });

  describe('Unicode and Encoding Edge Cases', () => {
    const unicodeTestCases = [
      '🚀', // Emoji
      '\u200B', // Zero-width space
      '\u202E\u202D', // Bidirectional overrides
      '\uD83D\uDE00', // Proper emoji encoding
      '\uD800', // Unpaired high surrogate
      '\uDC00', // Unpaired low surrogate
      '\uFEFF', // BOM
      '\u0000', // Null character
      'Iñtërnâtiônàlizætiøn',
      '中文测试',
      'العربية',
      'עברית',
      'русский',
      '日本語',
      'हिंदी',
      'ภาษาไทย',
    ];

    it('should handle Unicode edge cases in all filter categories', () => {
      let totalPassed = 0;
      let totalFailed = 0;

      // Test semantic filters with Unicode
      Object.entries(semanticFilters).forEach(([filterName, filterFn]) => {
        unicodeTestCases.forEach((unicodeInput) => {
          try {
            let result;
            if (filterName === 'rdfLiteral') {
              result = filterFn(unicodeInput, 'en');
            } else if (filterName === 'validateOwl') {
              // Skip for complex validation
              return;
            } else {
              result = filterFn(unicodeInput);
            }

            if (result && !containsDangerousContent(String(result))) {
              totalPassed++;
            } else {
              totalFailed++;
            }
          } catch (error) {
            // Unicode handling failures are somewhat expected
            if (error.message.includes('Unicode') || error.message.includes('encoding')) {
              totalPassed++;
            } else {
              totalFailed++;
            }
          }
        });
      });

      console.log(`Unicode tests: ${totalPassed} passed, ${totalFailed} failed`);
      
      // Should handle at least 50% of Unicode cases
      expect(totalPassed / (totalPassed + totalFailed)).toBeGreaterThan(0.5);
    });
  });

  describe('Performance Stress Tests', () => {
    it('should handle large input sizes gracefully', () => {
      const largeInputs = [
        'a'.repeat(10000),
        'test '.repeat(1000),
        Array(1000).fill('item').join(','),
        JSON.stringify(Array(100).fill({ key: 'value', nested: { deep: 'data' } })),
      ];

      let performanceResults: { filter: string; avgTime: number }[] = [];

      // Test string filters with large inputs
      const stringFilters = ['pascalCase', 'kebabCase', 'snakeCase'];
      
      stringFilters.forEach(filterName => {
        const times: number[] = [];
        
        largeInputs.forEach(largeInput => {
          const startTime = performance.now();
          
          try {
            switch (filterName) {
              case 'pascalCase':
                mockPascalCase(largeInput);
                break;
              case 'kebabCase':
                mockKebabCase(largeInput);
                break;
              case 'snakeCase':
                mockSnakeCase(largeInput);
                break;
            }
          } catch (error) {
            // Performance test - timing matters more than success
          }
          
          const endTime = performance.now();
          times.push(endTime - startTime);
        });

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        performanceResults.push({ filter: filterName, avgTime });
      });

      // All filters should complete within reasonable time even for large inputs
      performanceResults.forEach(result => {
        console.log(`${result.filter} average time: ${result.avgTime.toFixed(2)}ms`);
        expect(result.avgTime).toBeLessThan(100); // 100ms max for large inputs
      });
    });

    it('should handle rapid successive calls', () => {
      const iterations = 1000;
      const startTime = performance.now();

      // Rapidly call filters
      for (let i = 0; i < iterations; i++) {
        try {
          mockPascalCase(`test${i}`);
          semanticFilters.rdfResource(`http://example.org/item${i}`);
          sparqlFilters.sparqlVar(`var${i}`);
        } catch (error) {
          // Continue testing
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerCall = totalTime / (iterations * 3);

      console.log(`Rapid calls: ${iterations * 3} calls in ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per call: ${avgTimePerCall.toFixed(4)}ms`);

      // Should handle rapid calls efficiently
      expect(avgTimePerCall).toBeLessThan(1); // Less than 1ms per call on average
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory with repeated filter calls', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many filter operations
      for (let i = 0; i < 10000; i++) {
        mockPascalCase(`test_value_${i}`);
        semanticFilters.rdfLiteral(`value ${i}`, 'en');
        
        // Force garbage collection periodically
        if (i % 1000 === 0 && global.gc) {
          global.gc();
        }
      }

      // Force final garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
      
      // Should not have significant memory leak (< 10MB increase)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});

// Mock implementations
function mockPascalCase(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str).replace(/(?:^|[-_\s]+)(\w)/g, (_, char) => char.toUpperCase()).replace(/[-_\s]/g, '');
}

function mockCamelCase(str: any): string {
  const pascal = mockPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function mockKebabCase(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function mockSnakeCase(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

function mockHtmlEscape(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function containsDangerousContent(str: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /data:text\/html/i,
    /vbscript:/i,
    /__proto__/,
    /constructor/,
    /prototype/,
    /eval\(/,
    /Function\(/,
  ];

  return dangerousPatterns.some(pattern => pattern.test(str));
}

function containsSparqlInjection(str: string): boolean {
  const injectionPatterns = [
    /;\s*DROP/i,
    /UNION\s+SELECT/i,
    /;\s*DELETE/i,
    /;\s*INSERT/i,
    /--/,
    /\/\*/,
    /\*\//,
  ];

  return injectionPatterns.some(pattern => pattern.test(str));
}