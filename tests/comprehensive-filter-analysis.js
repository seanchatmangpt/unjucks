/**
 * Comprehensive Nunjucks Filter Analysis and Breaking Test Suite
 * Tests all filters with edge cases to identify broken functionality
 */

import nunjucks from 'nunjucks';
import { addCommonFilters } from '../src/lib/nunjucks-filters.js';
import { registerLaTeXFilters, LaTeXFilters } from '../src/lib/filters/latex.js';
import path from 'path';
import fs from 'fs';

/**
 * Filter Breaker Test Suite
 */
class FilterBreaker {
  constructor() {
    this.env = nunjucks.configure();
    this.results = {
      builtInFilters: {},
      customFilters: {},
      laTeXFilters: {},
      chainedFilters: {},
      performance: {},
      unicode: {},
      errors: []
    };
    this.setupEnvironment();
  }

  setupEnvironment() {
    try {
      // Add all custom filters
      addCommonFilters(this.env);
      registerLaTeXFilters(this.env);
      
      console.log('✅ Filter environment setup completed');
    } catch (error) {
      console.error('❌ Failed to setup filter environment:', error);
      this.results.errors.push({
        type: 'setup',
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Test built-in Nunjucks filters
   */
  testBuiltInFilters() {
    console.log('\n🔍 Testing Built-in Nunjucks Filters...');
    
    const builtInFilters = [
      'abs', 'attr', 'batch', 'capitalize', 'center', 'default', 
      'dictsort', 'dump', 'escape', 'filesizeformat', 'first', 
      'float', 'forceescape', 'groupby', 'indent', 'int', 'join', 
      'last', 'length', 'list', 'lower', 'nl2br', 'random', 
      'reject', 'rejectattr', 'replace', 'reverse', 'round', 
      'safe', 'select', 'selectattr', 'slice', 'sort', 'string', 
      'striptags', 'sum', 'title', 'trim', 'truncate', 'upper', 
      'urlencode', 'urlize', 'wordcount'
    ];

    const testCases = [
      { name: 'null', value: null },
      { name: 'undefined', value: undefined },
      { name: 'empty_string', value: '' },
      { name: 'number_zero', value: 0 },
      { name: 'boolean_false', value: false },
      { name: 'array_empty', value: [] },
      { name: 'object_empty', value: {} },
      { name: 'string_with_unicode', value: '🚀 Unicode: héłłø wørłđ 中文 العربية' },
      { name: 'very_long_string', value: 'x'.repeat(10000) },
      { name: 'nested_object', value: { a: { b: { c: [1, 2, 3] } } } },
      { name: 'circular_reference', value: (() => { const obj = {}; obj.self = obj; return obj; })() },
      { name: 'function', value: () => 'test' },
      { name: 'symbol', value: Symbol('test') },
      { name: 'big_int', value: BigInt(123) }
    ];

    builtInFilters.forEach(filterName => {
      this.results.builtInFilters[filterName] = {};
      
      testCases.forEach(testCase => {
        try {
          const template = `{{ value | ${filterName} }}`;
          const result = this.env.renderString(template, { value: testCase.value });
          
          this.results.builtInFilters[filterName][testCase.name] = {
            status: 'success',
            result: result.length > 100 ? result.substring(0, 100) + '...' : result,
            resultLength: result.length
          };
        } catch (error) {
          this.results.builtInFilters[filterName][testCase.name] = {
            status: 'error',
            error: error.message,
            errorType: error.constructor.name
          };
        }
      });
    });
  }

  /**
   * Test custom filters from nunjucks-filters.js
   */
  testCustomFilters() {
    console.log('\n🔍 Testing Custom Filters...');
    
    const customFilters = [
      'pascalCase', 'camelCase', 'kebabCase', 'snakeCase', 'constantCase',
      'titleCase', 'sentenceCase', 'slug', 'humanize', 'classify', 'tableize',
      'pluralize', 'singular', 'formatDate', 'dateAdd', 'dateSub', 'dateFrom',
      'fakeName', 'fakeEmail', 'fakeUuid', 'fakeNumber', 'fakeSchema'
    ];

    const edgeCases = [
      { name: 'null', value: null },
      { name: 'undefined', value: undefined },
      { name: 'empty_string', value: '' },
      { name: 'non_string_number', value: 42 },
      { name: 'non_string_array', value: [1, 2, 3] },
      { name: 'non_string_object', value: { key: 'value' } },
      { name: 'string_with_special_chars', value: '!@#$%^&*()_+-=[]{}|;:,.<>?' },
      { name: 'string_with_unicode', value: '🌟 Unicode: αβγ 中文 русский العربية' },
      { name: 'very_long_string', value: 'Lorem ipsum '.repeat(1000) },
      { name: 'string_with_html', value: '<script>alert("xss")</script><div>content</div>' },
      { name: 'string_with_sql', value: "'; DROP TABLE users; --" },
      { name: 'malformed_date', value: '2023-13-45T25:70:99Z' },
      { name: 'binary_data', value: Buffer.from('binary data', 'utf8') },
      { name: 'deeply_nested', value: { a: { b: { c: { d: { e: 'deep' } } } } } }
    ];

    customFilters.forEach(filterName => {
      this.results.customFilters[filterName] = {};
      
      edgeCases.forEach(testCase => {
        try {
          const template = `{{ value | ${filterName} }}`;
          const result = this.env.renderString(template, { value: testCase.value });
          
          this.results.customFilters[filterName][testCase.name] = {
            status: 'success',
            result: result.length > 100 ? result.substring(0, 100) + '...' : result,
            resultLength: result.length,
            resultType: typeof result
          };
        } catch (error) {
          this.results.customFilters[filterName][testCase.name] = {
            status: 'error',
            error: error.message,
            errorType: error.constructor.name
          };
        }
      });
    });
  }

  /**
   * Test LaTeX filters specifically
   */
  testLaTeXFilters() {
    console.log('\n🔍 Testing LaTeX Filters...');
    
    const latexFilters = [
      'texEscape', 'mathMode', 'mathEnvironment', 'citation', 'latexCommand',
      'environment', 'latexDocClass', 'bibtex', 'biblatex', 'bluebook',
      'arXivMeta', 'arXivCategory', 'mscCodes', 'latexTable', 'latexFigure',
      'latexList', 'usePackage', 'section'
    ];

    const latexTestCases = [
      { name: 'null_input', value: null },
      { name: 'undefined_input', value: undefined },
      { name: 'empty_string', value: '' },
      { name: 'latex_special_chars', value: '\\{}$&%#^_~<>|"\'' },
      { name: 'unicode_math', value: '∫∞∑∏∆∇∂√∛∜ℝℂℤℕ' },
      { name: 'mixed_content', value: 'Text with $math$ and \\command{}' },
      { name: 'html_tags', value: '<div class="test">HTML content</div>' },
      { name: 'json_data', value: { type: 'article', key: 'test2023', title: 'Test Article' } },
      { name: 'array_data', value: ['item1', 'item2', 'item3'] },
      { name: 'complex_object', value: { 
          type: 'article', 
          key: 'complex2023',
          title: 'Complex Article with Special Chars: $&%',
          authors: ['Author 1', 'Author 2'],
          abstract: 'This is a test abstract with math: $E=mc^2$'
        }
      },
      { name: 'malicious_input', value: '${eval("malicious_code")}' },
      { name: 'very_large_input', value: 'x'.repeat(50000) }
    ];

    // Test direct access to LaTeX filters
    const latexFilterInstance = new LaTeXFilters();
    const directFilters = latexFilterInstance.getAllFilters();

    console.log('Available LaTeX filters:', Object.keys(directFilters));

    latexFilters.forEach(filterName => {
      this.results.laTeXFilters[filterName] = {
        directAccess: {},
        templateAccess: {}
      };
      
      // Test direct access
      const directFilter = directFilters[filterName];
      if (directFilter) {
        latexTestCases.forEach(testCase => {
          try {
            const result = directFilter(testCase.value);
            this.results.laTeXFilters[filterName].directAccess[testCase.name] = {
              status: 'success',
              result: typeof result === 'string' && result.length > 100 ? result.substring(0, 100) + '...' : result,
              resultType: typeof result
            };
          } catch (error) {
            this.results.laTeXFilters[filterName].directAccess[testCase.name] = {
              status: 'error',
              error: error.message,
              errorType: error.constructor.name
            };
          }
        });
      } else {
        this.results.laTeXFilters[filterName].directAccess = { error: 'Filter not found in direct access' };
      }
      
      // Test template access
      latexTestCases.forEach(testCase => {
        try {
          const template = `{{ value | ${filterName} }}`;
          const result = this.env.renderString(template, { value: testCase.value });
          
          this.results.laTeXFilters[filterName].templateAccess[testCase.name] = {
            status: 'success',
            result: result.length > 100 ? result.substring(0, 100) + '...' : result,
            resultLength: result.length
          };
        } catch (error) {
          this.results.laTeXFilters[filterName].templateAccess[testCase.name] = {
            status: 'error',
            error: error.message,
            errorType: error.constructor.name
          };
        }
      });
    });
  }

  /**
   * Test filter chaining with incompatible outputs
   */
  testFilterChaining() {
    console.log('\n🔍 Testing Filter Chaining...');
    
    const chainTests = [
      { name: 'string_to_math', template: '{{ "hello" | upper | mathMode }}' },
      { name: 'number_to_text_filter', template: '{{ 123 | abs | texEscape }}' },
      { name: 'array_to_string_filters', template: '{{ [1,2,3] | join(",") | pascalCase }}' },
      { name: 'null_through_chain', template: '{{ null | default("test") | upper | texEscape }}' },
      { name: 'complex_chain', template: '{{ "test_value" | camelCase | upper | texEscape | mathMode }}' },
      { name: 'date_format_chain', template: '{{ "2023-01-01" | formatDate("YYYY-MM-DD") | texEscape }}' },
      { name: 'fake_data_chain', template: '{{ fakeName | upper | texEscape }}' },
      { name: 'incompatible_types', template: '{{ {} | length | formatDate }}' },
      { name: 'circular_dependencies', template: '{{ value | dump | safe | texEscape }}' },
      { name: 'performance_heavy', template: '{{ "x" | repeat(1000) | upper | texEscape | mathMode }}' }
    ];

    chainTests.forEach(test => {
      try {
        const result = this.env.renderString(test.template, { 
          value: { self: 'circular' }
        });
        
        this.results.chainedFilters[test.name] = {
          status: 'success',
          result: result.length > 200 ? result.substring(0, 200) + '...' : result,
          resultLength: result.length
        };
      } catch (error) {
        this.results.chainedFilters[test.name] = {
          status: 'error',
          error: error.message,
          errorType: error.constructor.name,
          stack: error.stack ? error.stack.split('\n')[0] : 'No stack'
        };
      }
    });
  }

  /**
   * Test Unicode and special character handling
   */
  testUnicodeHandling() {
    console.log('\n🔍 Testing Unicode and Special Character Handling...');
    
    const unicodeTests = [
      { name: 'emoji', value: '🚀🌟💫⭐🔥💯🎉🎊🌈' },
      { name: 'chinese', value: '你好世界，这是一个测试' },
      { name: 'arabic', value: 'مرحبا بالعالم، هذا اختبار' },
      { name: 'russian', value: 'Привет мир, это тест' },
      { name: 'japanese', value: 'こんにちは世界、これはテストです' },
      { name: 'mathematical_symbols', value: '∫∞∑∏∆∇∂√∛∜ℝℂℤℕ∈∉⊂⊃∪∩' },
      { name: 'greek_letters', value: 'αβγδεζηθικλμνξοπρστυφχψω' },
      { name: 'combined_unicode', value: '🌟 Math: ∫₀^∞ e^{-x²} dx = √π 中文: 数学 العربية: الرياضيات' },
      { name: 'zero_width_chars', value: 'test\u200Bhidden\u200C\u200Dchars' },
      { name: 'rtl_override', value: 'normal\u202Ereversed\u202C' },
      { name: 'normalization_test', value: 'café' + 'café'.normalize('NFD') }, // composed vs decomposed
      { name: 'high_surrogates', value: '𝕳𝖊𝖑𝖑𝖔 𝖂𝖔𝖗𝖑𝖉' }
    ];

    const filtersToTest = ['texEscape', 'upper', 'lower', 'pascalCase', 'slug', 'mathMode'];

    filtersToTest.forEach(filterName => {
      this.results.unicode[filterName] = {};
      
      unicodeTests.forEach(test => {
        try {
          const template = `{{ value | ${filterName} }}`;
          const result = this.env.renderString(template, { value: test.value });
          
          this.results.unicode[filterName][test.name] = {
            status: 'success',
            input: test.value,
            result: result,
            inputLength: test.value.length,
            resultLength: result.length,
            byteLength: Buffer.from(result, 'utf8').length
          };
        } catch (error) {
          this.results.unicode[filterName][test.name] = {
            status: 'error',
            input: test.value,
            error: error.message,
            errorType: error.constructor.name
          };
        }
      });
    });
  }

  /**
   * Test performance with large datasets
   */
  testPerformance() {
    console.log('\n🔍 Testing Performance with Large Data...');
    
    const performanceTests = [
      {
        name: 'large_string_processing',
        data: 'Lorem ipsum dolor sit amet '.repeat(10000),
        filters: ['upper', 'texEscape', 'slug']
      },
      {
        name: 'large_array_processing',
        data: Array(10000).fill().map((_, i) => `Item ${i}`),
        filters: ['join', 'length']
      },
      {
        name: 'complex_object_processing',
        data: {
          type: 'article',
          key: 'performance2023',
          title: 'Performance Test Article '.repeat(100),
          authors: Array(1000).fill().map((_, i) => `Author ${i}`),
          keywords: Array(500).fill().map((_, i) => `keyword${i}`)
        },
        filters: ['dump', 'bibtex']
      },
      {
        name: 'repeated_filter_calls',
        data: 'test string',
        filters: ['upper'],
        iterations: 100000
      }
    ];

    performanceTests.forEach(test => {
      const results = {};
      
      test.filters.forEach(filterName => {
        const startTime = process.hrtime.bigint();
        let success = true;
        let error = null;
        
        try {
          const iterations = test.iterations || 1;
          for (let i = 0; i < iterations; i++) {
            const template = `{{ data | ${filterName} }}`;
            this.env.renderString(template, { data: test.data });
          }
        } catch (e) {
          success = false;
          error = e.message;
        }
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        results[filterName] = {
          success,
          error,
          duration_ms: duration,
          iterations: test.iterations || 1,
          avg_per_iteration: test.iterations ? duration / test.iterations : duration
        };
      });
      
      this.results.performance[test.name] = results;
    });
  }

  /**
   * Check filter registration and availability
   */
  checkFilterRegistration() {
    console.log('\n🔍 Checking Filter Registration...');
    
    const expectedFilters = {
      builtin: ['upper', 'lower', 'capitalize', 'length', 'join', 'default'],
      custom: ['pascalCase', 'camelCase', 'kebabCase', 'snakeCase', 'formatDate', 'fakeName'],
      latex: ['texEscape', 'mathMode', 'citation', 'bibtex', 'latexCommand', 'environment']
    };

    this.results.registration = {};

    Object.entries(expectedFilters).forEach(([category, filters]) => {
      this.results.registration[category] = {};
      
      filters.forEach(filterName => {
        try {
          // Try to access the filter directly
          const filter = this.env.filters[filterName];
          const isRegistered = typeof filter === 'function';
          
          // Try to use it in a template
          let templateWorks = false;
          try {
            this.env.renderString(`{{ "test" | ${filterName} }}`);
            templateWorks = true;
          } catch (e) {
            // Filter might exist but not work with this input
          }
          
          this.results.registration[category][filterName] = {
            registered: isRegistered,
            templateAccessible: templateWorks,
            filterType: typeof filter
          };
        } catch (error) {
          this.results.registration[category][filterName] = {
            registered: false,
            templateAccessible: false,
            error: error.message
          };
        }
      });
    });
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting Comprehensive Filter Breaking Tests...\n');
    
    const startTime = Date.now();
    
    try {
      this.checkFilterRegistration();
      this.testBuiltInFilters();
      this.testCustomFilters();
      this.testLaTeXFilters();
      this.testFilterChaining();
      this.testUnicodeHandling();
      this.testPerformance();
      
      const endTime = Date.now();
      this.results.executionTime = endTime - startTime;
      
      console.log(`\n✅ All tests completed in ${this.results.executionTime}ms`);
      
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      this.results.errors.push({
        type: 'execution',
        error: error.message,
        stack: error.stack
      });
    }
    
    return this.results;
  }

  /**
   * Generate detailed report
   */
  generateReport() {
    console.log('\n📊 COMPREHENSIVE FILTER ANALYSIS REPORT');
    console.log('=====================================\n');

    // Registration Report
    console.log('🔗 FILTER REGISTRATION ANALYSIS:');
    Object.entries(this.results.registration || {}).forEach(([category, filters]) => {
      console.log(`\n  ${category.toUpperCase()} FILTERS:`);
      Object.entries(filters).forEach(([name, info]) => {
        const status = info.registered && info.templateAccessible ? '✅' : 
                      info.registered ? '⚠️' : '❌';
        console.log(`    ${status} ${name}: registered=${info.registered}, accessible=${info.templateAccessible}`);
      });
    });

    // LaTeX Filter Issues
    console.log('\n🧮 LATEX FILTER ISSUES:');
    Object.entries(this.results.laTeXFilters).forEach(([filterName, tests]) => {
      let hasIssues = false;
      let directAccessWorks = tests.directAccess && !tests.directAccess.error;
      let templateAccessWorks = false;
      
      if (tests.templateAccess) {
        templateAccessWorks = Object.values(tests.templateAccess).some(result => result.status === 'success');
      }

      if (!directAccessWorks || !templateAccessWorks) {
        hasIssues = true;
        console.log(`  ❌ ${filterName}:`);
        console.log(`      Direct access: ${directAccessWorks ? '✅' : '❌'}`);
        console.log(`      Template access: ${templateAccessWorks ? '✅' : '❌'}`);
        
        if (tests.directAccess?.error) {
          console.log(`      Error: ${tests.directAccess.error}`);
        }
      }
    });

    // Error Summary
    console.log('\n❌ ERROR SUMMARY:');
    if (this.results.errors.length === 0) {
      console.log('  No setup errors detected');
    } else {
      this.results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.type}: ${error.error}`);
      });
    }

    // Performance Issues
    console.log('\n⚡ PERFORMANCE ISSUES:');
    Object.entries(this.results.performance).forEach(([testName, results]) => {
      Object.entries(results).forEach(([filterName, perf]) => {
        if (perf.duration_ms > 1000) { // Slow if >1 second
          console.log(`  🐌 ${testName}.${filterName}: ${perf.duration_ms.toFixed(2)}ms`);
        }
        if (!perf.success) {
          console.log(`  💥 ${testName}.${filterName}: ${perf.error}`);
        }
      });
    });

    // Unicode Issues
    console.log('\n🌐 UNICODE HANDLING ISSUES:');
    Object.entries(this.results.unicode).forEach(([filterName, tests]) => {
      const failures = Object.entries(tests).filter(([_, result]) => result.status === 'error');
      if (failures.length > 0) {
        console.log(`  ❌ ${filterName}: ${failures.length} Unicode test failures`);
        failures.forEach(([testName, result]) => {
          console.log(`      ${testName}: ${result.error}`);
        });
      }
    });

    console.log('\n📋 SUMMARY:');
    console.log(`  Total execution time: ${this.results.executionTime}ms`);
    console.log(`  Setup errors: ${this.results.errors.length}`);
    console.log(`  LaTeX filters tested: ${Object.keys(this.results.laTeXFilters).length}`);
    console.log(`  Custom filters tested: ${Object.keys(this.results.customFilters).length}`);
    console.log(`  Built-in filters tested: ${Object.keys(this.results.builtInFilters).length}`);
  }

  /**
   * Save results to file
   */
  async saveResults(filename = 'filter-analysis-results.json') {
    const outputPath = path.join(process.cwd(), 'tests', 'reports', filename);
    
    try {
      // Ensure directory exists
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      
      // Save results
      await fs.promises.writeFile(
        outputPath, 
        JSON.stringify(this.results, null, 2), 
        'utf8'
      );
      
      console.log(`\n💾 Results saved to: ${outputPath}`);
    } catch (error) {
      console.error('❌ Failed to save results:', error);
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new FilterBreaker();
  const results = await tester.runAllTests();
  tester.generateReport();
  await tester.saveResults();
  
  // Exit with error code if there are issues
  const hasIssues = results.errors.length > 0 || 
    Object.values(results.laTeXFilters).some(filter => 
      filter.directAccess?.error || 
      !Object.values(filter.templateAccess || {}).some(test => test.status === 'success')
    );
  
  process.exit(hasIssues ? 1 : 0);
}

export default FilterBreaker;