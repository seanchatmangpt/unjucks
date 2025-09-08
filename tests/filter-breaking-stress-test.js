/**
 * Comprehensive Filter Breaking Stress Test
 * This script attempts to break all filters with extreme edge cases
 */

import nunjucks from 'nunjucks';
import { addCommonFilters } from '../src/lib/nunjucks-filters.js';
import { registerLaTeXFilters } from '../src/lib/filters/latex.js';

class FilterStressTester {
  constructor() {
    this.env = nunjucks.configure();
    this.results = {
      broken: [],
      vulnerable: [],
      performanceIssues: [],
      unicodeIssues: [],
      typeErrors: [],
      securityIssues: []
    };
    
    // Setup environment
    addCommonFilters(this.env);
    registerLaTeXFilters(this.env);
  }

  /**
   * Extreme edge cases designed to break filters
   */
  getBreakingTestCases() {
    return {
      // Null/undefined variants
      nullish: [
        null, undefined, '', NaN, 0, false, [], {}
      ],
      
      // Type confusion attacks
      typeConfusion: [
        Symbol('test'),
        BigInt(123),
        new Date(),
        /regex/,
        new Error('test'),
        new Map(),
        new Set(),
        new WeakMap(),
        new WeakSet(),
        new ArrayBuffer(10),
        new Int32Array([1, 2, 3]),
        new Blob(['test']),
        Promise.resolve('test'),
        function() { return 'test'; },
        () => 'arrow',
        async function() { return 'async'; },
        function* generator() { yield 'gen'; }
      ],

      // Circular references
      circular: (() => {
        const obj = { name: 'test' };
        obj.self = obj;
        obj.nested = { parent: obj };
        return [obj];
      })(),

      // Massive data
      massive: [
        'x'.repeat(1000000), // 1MB string
        Array(100000).fill('item'), // 100k array
        { data: 'x'.repeat(100000) }, // Large object
        Array(1000).fill().map((_, i) => ({ id: i, data: 'x'.repeat(1000) })) // Many objects
      ],

      // Unicode edge cases
      unicode: [
        '\u0000\u0001\u0002\u0003', // Control characters
        '\u200B\u200C\u200D\u200E\u200F', // Zero-width characters
        '\uFEFF\uFFFF\uD800\uDFFF', // BOM and high surrogates
        '🏳️‍🌈🏴‍☠️👨‍👩‍👧‍👦', // Complex emoji sequences
        'á́́́́́́́́́́́́́́́́', // Combining character abuse
        '𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ', // Mathematical script
        'Ａｂｃｄｅｆｇ', // Full-width characters
        'АВСДЕавсде', // Cyrillic that looks like Latin
        '\uFF1C\uFF1E\uFF5C\uFF06\uFF05', // Full-width symbols
        '٩(◕‿◕)۶ ٩(◕‿◕)۶', // RTL with emoticons
      ],

      // LaTeX-specific breaking cases
      latexBreakers: [
        '\\def\\foo{\\bar}\\foo', // LaTeX command definitions
        '$\\left(\\frac{1}{2}\\right)_{x=0}^{\\infty}$', // Complex math
        '\\begin{verbatim}\\end{verbatim}', // Verbatim environment
        '\\catcode`\\@=11 \\makeatletter', // Category code changes
        '\\expandafter\\def\\csname foo\\endcsname{bar}', // Expandafter trickery
        '\\write18{echo "shell command"}', // Shell escape attempts
        '\\input{/etc/passwd}', // File inclusion attempts
        '\\usepackage{shellesc}\\ShellEscape{rm -rf /}', // Shell escape package
        '\\let\\oldsection\\section\\def\\section#1{\\oldsection{HACKED: #1}}', // Command redefinition
      ],

      // Security-focused inputs
      security: [
        '<script>alert("xss")</script>',
        '${eval("global.process.exit(1)")}',
        '#{eval("system(\'rm -rf /\')")}',
        '{{constructor.constructor("return process")().exit()}}',
        '__proto__.toString.constructor("return process")().exit()',
        'java.lang.Runtime.getRuntime().exec("calc")',
        'require("child_process").exec("calc")',
        '../../../../../../etc/passwd',
        '../../../windows/system32/calc.exe',
        'data:text/html,<script>alert(1)</script>',
        'javascript:alert(1)',
        'vbscript:CreateObject("Wscript.Shell").Run("calc")',
      ],

      // Prototype pollution attempts
      prototypePollution: [
        { '__proto__': { 'polluted': true } },
        { 'constructor': { 'prototype': { 'polluted': true } } },
        JSON.parse('{"__proto__": {"polluted": true}}'),
        { ['__proto__']: { toString: () => 'polluted' } },
      ],

      // Performance bombs
      performanceBombs: [
        '('.repeat(10000) + ')'.repeat(10000), // Regex DoS
        'a'.repeat(1000000), // Memory bomb
        Array(10000).fill().map(() => Math.random().toString(36)), // CPU bomb
        { [Symbol.for('nodejs.util.inspect.custom')]: () => 'x'.repeat(1000000) }, // Inspect bomb
      ],

      // Filter-specific edge cases
      filterSpecific: {
        date: [
          '2023-02-30', // Invalid date
          '2023-13-01', // Invalid month
          'not-a-date',
          Infinity,
          -Infinity,
          new Date('invalid'),
        ],
        number: [
          Infinity,
          -Infinity,
          NaN,
          Number.MAX_SAFE_INTEGER + 1,
          Number.MIN_SAFE_INTEGER - 1,
          1.7976931348623157e+308,
        ],
        array: [
          new Proxy([], { get: () => { throw new Error('proxy trap'); } }),
          { length: Infinity },
          { length: -1 },
          { [Symbol.iterator]: () => { throw new Error('iterator bomb'); } },
        ]
      }
    };
  }

  /**
   * Test a filter with all breaking cases
   */
  testFilterBreaking(filterName) {
    const results = {
      filterName,
      passed: 0,
      failed: 0,
      crashed: 0,
      errors: [],
      warnings: [],
      securityFlags: []
    };

    const testCases = this.getBreakingTestCases();
    
    // Flatten all test cases
    const allTests = [
      ...testCases.nullish,
      ...testCases.typeConfusion,
      ...testCases.circular,
      ...testCases.unicode,
      ...testCases.latexBreakers,
      ...testCases.security,
      ...testCases.prototypePollution,
      ...testCases.performanceBombs,
      ...testCases.filterSpecific.date,
      ...testCases.filterSpecific.number,
      ...testCases.filterSpecific.array
    ];

    // Add massive data separately due to size
    allTests.push(...testCases.massive.slice(0, 2)); // Only test first 2 to avoid memory issues

    allTests.forEach((testValue, index) => {
      try {
        const template = `{{ value | ${filterName} }}`;
        const startTime = process.hrtime.bigint();
        
        // Test with timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 5000);
        });
        
        const renderPromise = Promise.resolve(this.env.renderString(template, { value: testValue }));
        
        Promise.race([renderPromise, timeoutPromise])
          .then(result => {
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000; // ms
            
            // Check for performance issues
            if (duration > 1000) {
              results.warnings.push({
                test: index,
                issue: 'Performance',
                message: `Slow execution: ${duration.toFixed(2)}ms`,
                input: typeof testValue === 'string' ? testValue.substring(0, 100) : String(testValue).substring(0, 100)
              });
              this.results.performanceIssues.push({ filter: filterName, duration, input: testValue });
            }

            // Check for security issues in output
            if (typeof result === 'string') {
              if (result.includes('<script') || result.includes('javascript:') || result.includes('eval(')) {
                results.securityFlags.push({
                  test: index,
                  message: 'Potential XSS in output',
                  output: result.substring(0, 200)
                });
                this.results.securityIssues.push({ filter: filterName, input: testValue, output: result });
              }
            }

            results.passed++;
          })
          .catch(error => {
            if (error.message === 'Timeout') {
              results.crashed++;
              results.errors.push({
                test: index,
                error: 'Timeout - possible infinite loop or DoS',
                input: typeof testValue === 'string' ? testValue.substring(0, 100) : String(testValue).substring(0, 100)
              });
            } else {
              results.failed++;
              results.errors.push({
                test: index,
                error: error.message,
                type: error.constructor.name,
                input: typeof testValue === 'string' ? testValue.substring(0, 100) : String(testValue).substring(0, 100)
              });
            }
          });
      } catch (error) {
        results.crashed++;
        results.errors.push({
          test: index,
          error: error.message,
          type: error.constructor.name,
          input: typeof testValue === 'string' ? testValue.substring(0, 100) : String(testValue).substring(0, 100)
        });

        // Check for critical crashes
        if (error.name === 'RangeError' || error.message.includes('out of memory')) {
          this.results.broken.push({ filter: filterName, reason: 'Memory exhaustion', error: error.message });
        }
      }
    });

    return results;
  }

  /**
   * Run comprehensive breaking tests
   */
  runBreakingTests() {
    console.log('🚨 STARTING COMPREHENSIVE FILTER BREAKING TESTS\n');
    
    // Get all registered filters
    const filtersToTest = [
      // Built-in filters
      'upper', 'lower', 'capitalize', 'length', 'join', 'default', 'abs',
      // Custom filters
      'pascalCase', 'camelCase', 'kebabCase', 'snakeCase', 'formatDate', 'fakeName',
      // LaTeX filters
      'texEscape', 'mathMode', 'citation', 'bibtex', 'latexCommand', 'environment'
    ];

    const allResults = [];

    filtersToTest.forEach(filterName => {
      console.log(`Testing ${filterName}...`);
      const result = this.testFilterBreaking(filterName);
      allResults.push(result);
      
      // Immediate feedback
      const successRate = (result.passed / (result.passed + result.failed + result.crashed) * 100).toFixed(1);
      if (result.crashed > 0) {
        console.log(`  ❌ ${filterName}: ${result.crashed} CRASHES, ${result.failed} errors, ${result.passed} passed (${successRate}%)`);
      } else if (result.failed > 5) {
        console.log(`  ⚠️  ${filterName}: ${result.failed} errors, ${result.passed} passed (${successRate}%)`);
      } else {
        console.log(`  ✅ ${filterName}: ${result.failed} errors, ${result.passed} passed (${successRate}%)`);
      }
    });

    return allResults;
  }

  /**
   * Generate breaking report
   */
  generateBreakingReport(results) {
    console.log('\n💥 FILTER BREAKING ANALYSIS REPORT');
    console.log('===================================\n');

    // Critical issues
    const criticalFilters = results.filter(r => r.crashed > 0);
    if (criticalFilters.length > 0) {
      console.log('🚨 CRITICAL ISSUES (Crashes/Hangs):');
      criticalFilters.forEach(filter => {
        console.log(`  ❌ ${filter.filterName}: ${filter.crashed} crashes`);
        filter.errors.slice(0, 3).forEach(error => {
          if (error.error.includes('Timeout') || error.error.includes('memory')) {
            console.log(`    - ${error.error}: ${error.input}`);
          }
        });
      });
      console.log('');
    }

    // Security issues
    if (this.results.securityIssues.length > 0) {
      console.log('🔒 SECURITY VULNERABILITIES:');
      this.results.securityIssues.forEach(issue => {
        console.log(`  🚨 ${issue.filter}: Potential XSS/injection vulnerability`);
        console.log(`    Input: ${JSON.stringify(issue.input).substring(0, 100)}`);
        console.log(`    Output: ${issue.output.substring(0, 100)}`);
      });
      console.log('');
    }

    // Performance issues
    if (this.results.performanceIssues.length > 0) {
      console.log('⚡ PERFORMANCE ISSUES:');
      this.results.performanceIssues.slice(0, 10).forEach(issue => {
        console.log(`  🐌 ${issue.filter}: ${issue.duration.toFixed(2)}ms`);
      });
      console.log('');
    }

    // Most fragile filters
    const fragileFilters = results
      .filter(r => r.failed > 0)
      .sort((a, b) => b.failed - a.failed)
      .slice(0, 5);
    
    if (fragileFilters.length > 0) {
      console.log('🏃‍♂️ MOST FRAGILE FILTERS:');
      fragileFilters.forEach(filter => {
        const errorRate = (filter.failed / (filter.passed + filter.failed + filter.crashed) * 100).toFixed(1);
        console.log(`  ⚠️  ${filter.filterName}: ${filter.failed} errors (${errorRate}% failure rate)`);
        
        // Show most common error types
        const errorTypes = {};
        filter.errors.forEach(error => {
          errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
        });
        
        Object.entries(errorTypes)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .forEach(([type, count]) => {
            console.log(`    - ${type}: ${count} occurrences`);
          });
      });
      console.log('');
    }

    // Most robust filters
    const robustFilters = results
      .filter(r => r.failed === 0 && r.crashed === 0)
      .sort((a, b) => b.passed - a.passed)
      .slice(0, 5);

    if (robustFilters.length > 0) {
      console.log('💪 MOST ROBUST FILTERS:');
      robustFilters.forEach(filter => {
        console.log(`  ✅ ${filter.filterName}: ${filter.passed} tests passed, 0 failures`);
      });
      console.log('');
    }

    // Summary statistics
    const totalTests = results.reduce((sum, r) => sum + r.passed + r.failed + r.crashed, 0);
    const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalCrashed = results.reduce((sum, r) => sum + r.crashed, 0);

    console.log('📊 SUMMARY STATISTICS:');
    console.log(`  Total tests: ${totalTests}`);
    console.log(`  Passed: ${totalPassed} (${(totalPassed/totalTests*100).toFixed(1)}%)`);
    console.log(`  Failed: ${totalFailed} (${(totalFailed/totalTests*100).toFixed(1)}%)`);
    console.log(`  Crashed: ${totalCrashed} (${(totalCrashed/totalTests*100).toFixed(1)}%)`);
    console.log(`  Filters tested: ${results.length}`);
    console.log(`  Critical issues: ${criticalFilters.length}`);
    console.log(`  Security issues: ${this.results.securityIssues.length}`);
    console.log(`  Performance issues: ${this.results.performanceIssues.length}`);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new FilterStressTester();
  const results = tester.runBreakingTests();
  tester.generateBreakingReport(results);
}

export default FilterStressTester;