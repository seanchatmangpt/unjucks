/**
 * Comprehensive Filter Validation Report Generator
 * Validates all 65+ filters and generates detailed test results
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import nunjucks from 'nunjucks';
import { addCommonFilters } from '../../src/lib/nunjucks-filters.js';
import fs from 'fs/promises';
import path from 'path';

describe('Comprehensive Filter Validation Report', () => {
  let env;
  let validationResults = {};
  
  beforeAll(() => {
    env = new nunjucks.Environment();
    addCommonFilters(env);
    validationResults = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFilters: 0,
        passedFilters: 0,
        failedFilters: 0,
        categories: {}
      },
      categories: {},
      details: []
    };
  });

  afterAll(async () => {
    // Generate comprehensive report
    const reportPath = path.join(process.cwd(), 'tests', 'filters', 'validation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(validationResults, null, 2));
    console.log(`\n📊 Filter validation report generated: ${reportPath}`);
  });

  describe('String Inflection Filters (15+ filters)', () => {
    const stringFilters = [
      { name: 'pascalCase', test: 'hello_world', expected: 'HelloWorld' },
      { name: 'camelCase', test: 'hello_world', expected: 'helloWorld' },
      { name: 'kebabCase', test: 'HelloWorld', expected: 'hello-world' },
      { name: 'snakeCase', test: 'HelloWorld', expected: 'hello_world' },
      { name: 'constantCase', test: 'hello world', expected: 'HELLO_WORLD' },
      { name: 'titleCase', test: 'hello world', expected: 'Hello World' },
      { name: 'sentenceCase', test: 'hello_world', expected: 'Hello world' },
      { name: 'slug', test: 'Hello World!', expected: 'hello-world' },
      { name: 'humanize', test: 'user_name', expected: 'User name' },
      { name: 'classify', test: 'user_posts', expected: 'UserPost' },
      { name: 'tableize', test: 'UserPost', expected: 'user_posts' },
      { name: 'demodulize', test: 'Admin::User', expected: 'User' },
      { name: 'pluralize', test: 'user', expected: 'users' },
      { name: 'singular', test: 'users', expected: 'user' },
      { name: 'truncate', test: 'very long text', expected: 'very long te...', params: '10' }
    ];

    it('should validate all string inflection filters', () => {
      validationResults.categories.stringInflection = {
        total: stringFilters.length,
        passed: 0,
        failed: 0,
        filters: {}
      };

      stringFilters.forEach(({ name, test, expected, params }) => {
        try {
          const template = params ? 
            `{{ "${test}" | ${name}(${params}) }}` : 
            `{{ "${test}" | ${name} }}`;
          
          const result = env.renderString(template);
          const passed = result.trim() === expected;
          
          validationResults.categories.stringInflection.filters[name] = {
            status: passed ? 'PASS' : 'FAIL',
            input: test,
            expected,
            actual: result.trim(),
            template
          };

          if (passed) {
            validationResults.categories.stringInflection.passed++;
          } else {
            validationResults.categories.stringInflection.failed++;
          }

          expect(result.trim()).toBe(expected);
        } catch (error) {
          validationResults.categories.stringInflection.filters[name] = {
            status: 'ERROR',
            input: test,
            expected,
            error: error.message
          };
          validationResults.categories.stringInflection.failed++;
          throw error;
        }
      });

      validationResults.summary.totalFilters += stringFilters.length;
    });
  });

  describe('Date/Time Filters (20+ filters)', () => {
    const dateFilters = [
      { name: 'formatDate', test: '2024-01-15T10:30:00Z', expected: '2024-01-15' },
      { name: 'dateAdd', test: '2024-01-15', expected: '2024-01-22', params: '7, "day"' },
      { name: 'dateSub', test: '2024-01-15', expected: '2024-01-08', params: '7, "day"' },
      { name: 'dateStart', test: '2024-01-15T10:30:00Z', expected: '2024-01-15', params: '"day"' },
      { name: 'dateEnd', test: '2024-01-15T10:30:00Z', expected: '2024-01-15', params: '"day"' },
      { name: 'dateUnix', test: '2024-01-15T10:30:00Z', expectedType: 'number' },
      { name: 'dateIso', test: '2024-01-15T10:30:00Z', expected: '2024-01-15T10:30:00.000Z' },
      { name: 'isToday', test: new Date().toISOString(), expected: 'true' }
    ];

    it('should validate date/time filters', () => {
      validationResults.categories.dateTime = {
        total: dateFilters.length,
        passed: 0,
        failed: 0,
        filters: {}
      };

      dateFilters.forEach(({ name, test, expected, expectedType, params }) => {
        try {
          const template = params ? 
            `{{ "${test}" | ${name}(${params}) | formatDate }}` : 
            expectedType ? 
            `{{ "${test}" | ${name} }}` :
            `{{ "${test}" | ${name} }}`;
          
          const result = env.renderString(template);
          let passed = false;
          
          if (expectedType === 'number') {
            passed = !isNaN(Number(result)) && Number(result) > 0;
          } else if (expected) {
            passed = result.trim() === expected;
          } else {
            passed = result.trim() !== '';
          }
          
          validationResults.categories.dateTime.filters[name] = {
            status: passed ? 'PASS' : 'FAIL',
            input: test,
            expected: expected || `${expectedType} type`,
            actual: result.trim(),
            template
          };

          if (passed) {
            validationResults.categories.dateTime.passed++;
          } else {
            validationResults.categories.dateTime.failed++;
          }

          expect(passed).toBe(true);
        } catch (error) {
          validationResults.categories.dateTime.filters[name] = {
            status: 'ERROR',
            input: test,
            error: error.message
          };
          validationResults.categories.dateTime.failed++;
          throw error;
        }
      });

      validationResults.summary.totalFilters += dateFilters.length;
    });
  });

  describe('Faker.js Integration (15+ filters)', () => {
    const fakerFilters = [
      { name: 'fakeName', expectedPattern: /^[A-Za-z\s]+$/ },
      { name: 'fakeEmail', expectedPattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ },
      { name: 'fakeAddress', expectedMinLength: 5 },
      { name: 'fakeCity', expectedPattern: /^[A-Za-z\s]+$/ },
      { name: 'fakePhone', expectedMinLength: 5 },
      { name: 'fakeCompany', expectedMinLength: 2 },
      { name: 'fakeUuid', expectedPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i },
      { name: 'fakeNumber', expectedType: 'number', params: '1, 100' },
      { name: 'fakeText', expectedMinLength: 10 },
      { name: 'fakeParagraph', expectedMinLength: 50 },
      { name: 'fakeDate', expectedType: 'date' },
      { name: 'fakeBoolean', expectedValues: ['true', 'false'] },
      { name: 'fakeSeed', expected: 'Faker seed set to 123', params: '123' }
    ];

    it('should validate Faker.js filters', () => {
      validationResults.categories.faker = {
        total: fakerFilters.length,
        passed: 0,
        failed: 0,
        filters: {}
      };

      fakerFilters.forEach(({ name, expectedPattern, expectedMinLength, expectedType, expectedValues, expected, params }) => {
        try {
          const template = params ? 
            `{{ ${name}(${params}) }}` : 
            `{{ ${name}() }}`;
          
          const result = env.renderString(template);
          let passed = false;
          let validationMsg = '';

          if (expectedPattern) {
            passed = expectedPattern.test(result);
            validationMsg = `Pattern: ${expectedPattern}`;
          } else if (expectedMinLength) {
            passed = result.length >= expectedMinLength;
            validationMsg = `Min length: ${expectedMinLength}`;
          } else if (expectedType === 'number') {
            passed = !isNaN(Number(result));
            validationMsg = 'Should be numeric';
          } else if (expectedType === 'date') {
            passed = !isNaN(new Date(result).getTime());
            validationMsg = 'Should be valid date';
          } else if (expectedValues) {
            passed = expectedValues.includes(result);
            validationMsg = `Should be one of: ${expectedValues.join(', ')}`;
          } else if (expected) {
            passed = result === expected;
            validationMsg = `Should equal: ${expected}`;
          }
          
          validationResults.categories.faker.filters[name] = {
            status: passed ? 'PASS' : 'FAIL',
            expected: validationMsg,
            actual: result,
            template
          };

          if (passed) {
            validationResults.categories.faker.passed++;
          } else {
            validationResults.categories.faker.failed++;
          }

          expect(passed).toBe(true);
        } catch (error) {
          validationResults.categories.faker.filters[name] = {
            status: 'ERROR',
            error: error.message
          };
          validationResults.categories.faker.failed++;
          throw error;
        }
      });

      validationResults.summary.totalFilters += fakerFilters.length;
    });
  });

  describe('Semantic Web/RDF Filters (20+ filters)', () => {
    const rdfFilters = [
      { name: 'rdfResource', test: 'Person', expected: 'http://example.org/Person' },
      { name: 'rdfProperty', test: 'user_name', expected: 'http://example.org/userName' },
      { name: 'rdfClass', test: 'person', expected: 'http://example.org/Person' },
      { name: 'rdfDatatype', test: 'John', expected: '"John"^^xsd:string', params: '"string"' },
      { name: 'rdfLiteral', test: 'Hello', expected: '"Hello"@en', params: '"en"' },
      { name: 'sparqlVar', test: 'person', expected: '?person' },
      { name: 'turtleEscape', test: 'Line\nBreak', expected: 'Line\\nBreak' },
      { name: 'schemaOrg', test: 'person', expected: 'schema:Person' },
      { name: 'dublinCore', test: 'title', expected: 'dcterms:title' },
      { name: 'foaf', test: 'name', expected: 'foaf:name' },
      { name: 'skos', test: 'concept', expected: 'skos:Concept' },
      { name: 'owl', test: 'class', expected: 'owl:Class' },
      { name: 'rdfUuid', expectedPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i },
      { name: 'rdfGraph', test: 'user_data', expected: 'http://example.org/graphs/user-data' },
      { name: 'sparqlFilter', test: '?age > 18', expected: 'FILTER(?age > 18)' },
      { name: 'rdfList', test: ['a', 'b', 'c'], expected: '( "a" "b" "c" )' },
      { name: 'blankNode', expectedPattern: /^_:b[a-z0-9]{8}$/ },
      { name: 'curie', test: 'http://xmlns.com/foaf/0.1/Person', expected: 'foaf:Person' }
    ];

    it('should validate semantic web/RDF filters', () => {
      validationResults.categories.semanticWeb = {
        total: rdfFilters.length,
        passed: 0,
        failed: 0,
        filters: {}
      };

      rdfFilters.forEach(({ name, test, expected, expectedPattern, params }) => {
        try {
          let template;
          if (name === 'rdfUuid' || name === 'blankNode') {
            template = `{{ ${name}() }}`;
          } else if (Array.isArray(test)) {
            template = `{{ ${JSON.stringify(test)} | ${name} }}`;
          } else if (params) {
            template = `{{ "${test}" | ${name}(${params}) }}`;
          } else {
            template = `{{ "${test}" | ${name} }}`;
          }
          
          const result = env.renderString(template);
          let passed = false;

          if (expectedPattern) {
            passed = expectedPattern.test(result);
          } else if (expected) {
            passed = result === expected;
          }
          
          validationResults.categories.semanticWeb.filters[name] = {
            status: passed ? 'PASS' : 'FAIL',
            input: test,
            expected: expected || `Pattern: ${expectedPattern}`,
            actual: result,
            template
          };

          if (passed) {
            validationResults.categories.semanticWeb.passed++;
          } else {
            validationResults.categories.semanticWeb.failed++;
          }

          expect(passed).toBe(true);
        } catch (error) {
          validationResults.categories.semanticWeb.filters[name] = {
            status: 'ERROR',
            input: test,
            error: error.message
          };
          validationResults.categories.semanticWeb.failed++;
          throw error;
        }
      });

      validationResults.summary.totalFilters += rdfFilters.length;
    });
  });

  describe('Utility Filters (10+ filters)', () => {
    const utilityFilters = [
      { name: 'dump', test: { key: 'value' }, expected: '{\n  "key": "value"\n}' },
      { name: 'join', test: ['a', 'b', 'c'], expected: 'a,b,c', params: '","' },
      { name: 'default', test: null, expected: 'fallback', params: '"fallback"' },
      { name: 'upper', test: 'hello', expected: 'HELLO' },
      { name: 'lower', test: 'HELLO', expected: 'hello' },
      { name: 'capitalize', test: 'hello world', expected: 'Hello world' },
      { name: 'reverse', test: 'hello', expected: 'olleh' },
      { name: 'repeat', test: 'ha', expected: 'haha', params: '2' },
      { name: 'pad', test: 'hi', expected: ' hi ', params: '4' },
      { name: 'wrap', test: 'very long text here', expected: 'very long\ntext here', params: '10' }
    ];

    it('should validate utility filters', () => {
      validationResults.categories.utility = {
        total: utilityFilters.length,
        passed: 0,
        failed: 0,
        filters: {}
      };

      utilityFilters.forEach(({ name, test, expected, params }) => {
        try {
          let template;
          if (typeof test === 'object' && test !== null) {
            template = params ? 
              `{{ test | ${name}(${params}) }}` : 
              `{{ test | ${name} }}`;
          } else if (Array.isArray(test)) {
            template = params ? 
              `{{ ${JSON.stringify(test)} | ${name}(${params}) }}` : 
              `{{ ${JSON.stringify(test)} | ${name} }}`;
          } else {
            template = params ? 
              `{{ "${test}" | ${name}(${params}) }}` : 
              `{{ "${test}" | ${name} }}`;
          }
          
          const result = env.renderString(template, { test });
          const passed = result === expected;
          
          validationResults.categories.utility.filters[name] = {
            status: passed ? 'PASS' : 'FAIL',
            input: test,
            expected,
            actual: result,
            template
          };

          if (passed) {
            validationResults.categories.utility.passed++;
          } else {
            validationResults.categories.utility.failed++;
          }

          expect(result).toBe(expected);
        } catch (error) {
          validationResults.categories.utility.filters[name] = {
            status: 'ERROR',
            input: test,
            error: error.message
          };
          validationResults.categories.utility.failed++;
          throw error;
        }
      });

      validationResults.summary.totalFilters += utilityFilters.length;
    });
  });

  describe('Summary and Report Generation', () => {
    it('should generate comprehensive validation summary', () => {
      // Calculate summary statistics
      const categories = validationResults.categories;
      
      Object.keys(categories).forEach(category => {
        validationResults.summary.categories[category] = {
          total: categories[category].total,
          passed: categories[category].passed,
          failed: categories[category].failed,
          passRate: Math.round((categories[category].passed / categories[category].total) * 100)
        };
        
        validationResults.summary.passedFilters += categories[category].passed;
        validationResults.summary.failedFilters += categories[category].failed;
      });

      const totalPassRate = Math.round((validationResults.summary.passedFilters / validationResults.summary.totalFilters) * 100);
      
      // Log summary
      console.log('\n📋 COMPREHENSIVE FILTER VALIDATION SUMMARY');
      console.log('==========================================');
      console.log(`Total Filters Tested: ${validationResults.summary.totalFilters}`);
      console.log(`Passed: ${validationResults.summary.passedFilters} (${totalPassRate}%)`);
      console.log(`Failed: ${validationResults.summary.failedFilters} (${100 - totalPassRate}%)`);
      console.log('\nBy Category:');
      
      Object.entries(validationResults.summary.categories).forEach(([category, stats]) => {
        console.log(`  ${category}: ${stats.passed}/${stats.total} (${stats.passRate}%)`);
      });

      // Validate overall pass rate
      expect(totalPassRate).toBeGreaterThan(80); // At least 80% pass rate
    });

    it('should identify most problematic filters', () => {
      const failedFilters = [];
      
      Object.entries(validationResults.categories).forEach(([categoryName, category]) => {
        Object.entries(category.filters).forEach(([filterName, filter]) => {
          if (filter.status === 'FAIL' || filter.status === 'ERROR') {
            failedFilters.push({
              category: categoryName,
              filter: filterName,
              status: filter.status,
              error: filter.error || 'Assertion failure',
              input: filter.input,
              expected: filter.expected,
              actual: filter.actual
            });
          }
        });
      });

      if (failedFilters.length > 0) {
        console.log('\n⚠️  FAILED FILTERS:');
        failedFilters.forEach(failure => {
          console.log(`  ${failure.category}/${failure.filter}: ${failure.status}`);
          if (failure.error) console.log(`    Error: ${failure.error}`);
        });
      }

      validationResults.failedFilters = failedFilters;
    });
  });
});