import { describe, it, expect, beforeEach } from 'vitest';
import nunjucks from 'nunjucks';
import { sparqlFilters } from '../../../src/lib/filters/sparql';
import { Parser as SparqlParser } from 'sparqljs';
import { performance } from 'perf_hooks';

describe('SPARQL Performance Benchmarks', () => {
  let env: nunjucks.Environment;
  let parser: SparqlParser;

  beforeEach(() => {
    env = new nunjucks.Environment(
      new nunjucks.FileSystemLoader('tests/fixtures/sparql')
    );
    
    // Register all SPARQL filters
    Object.entries(sparqlFilters).forEach(([name, filter]) => {
      env.addFilter(name, filter);
    });

    parser = new SparqlParser();
  });

  describe('Filter Performance', () => {
    it('should handle large variable arrays efficiently', () => {
      const variables = Array.from({ length: 1000 }, (_, i) => `var${i}`);
      
      const start = performance.now();
      const result = variables.map(v => sparqlFilters.sparqlVar(v));
      const end = performance.now();
      
      expect(result).toHaveLength(1000);
      expect(result[0]).toBe('?var0');
      expect(result[999]).toBe('?var999');
      expect(end - start).toBeLessThan(10); // Should process 1000 variables in <10ms
    });

    it('should handle complex filter expressions efficiently', () => {
      const filters = Array.from({ length: 500 }, (_, i) => ({
        operator: 'equals',
        left: `var${i}`,
        right: `value${i}`
      }));
      
      const start = performance.now();
      const results = filters.map(f => sparqlFilters.sparqlFilter(f));
      const end = performance.now();
      
      expect(results).toHaveLength(500);
      expect(results[0]).toBe('?var0 = "value0"');
      expect(end - start).toBeLessThan(20); // Should process 500 filters in <20ms
    });

    it('should handle URI escaping efficiently', () => {
      const uris = Array.from({ length: 1000 }, (_, i) => 
        `http://example.com/resource/${i}?param=value&other=data`
      );
      
      const start = performance.now();
      const results = uris.map(uri => sparqlFilters.rdfResource(uri));
      const end = performance.now();
      
      expect(results).toHaveLength(1000);
      expect(results[0]).toBe('<http://example.com/resource/0?param=value&other=data>');
      expect(end - start).toBeLessThan(15); // Should process 1000 URIs in <15ms
    });

    it('should handle string escaping efficiently', () => {
      const strings = Array.from({ length: 1000 }, (_, i) => 
        `String with "quotes" and\nnewlines\tand\ttabs ${i}`
      );
      
      const start = performance.now();
      const results = strings.map(s => sparqlFilters.sparqlString(s));
      const end = performance.now();
      
      expect(results).toHaveLength(1000);
      expect(results[0]).toContain('\\"quotes\\"');
      expect(results[0]).toContain('\\n');
      expect(results[0]).toContain('\\t');
      expect(end - start).toBeLessThan(25); // Should process 1000 strings in <25ms
    });
  });

  describe('Template Rendering Performance', () => {
    it('should render large SELECT queries efficiently', async () => {
      const patterns = Array.from({ length: 100 }, (_, i) => ({
        subject: 'entity',
        predicate: `schema:prop${i}`,
        object: `val${i}`
      }));

      const variables = Array.from({ length: 50 }, (_, i) => `var${i}`);
      
      const filters = Array.from({ length: 20 }, (_, i) => ({
        operator: 'contains',
        left: `var${i}`,
        right: `search${i}`
      }));

      const data = {
        baseUri: 'http://example.com',
        variables,
        patterns,
        filters,
        distinct: true,
        orderBy: variables.slice(0, 5).map(v => ({ variable: v, direction: 'ASC' })),
        limit: 1000
      };

      const start = performance.now();
      const result = await env.render('select-query.sparql.njk', data);
      const end = performance.now();

      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('SELECT DISTINCT');
      expect(result).toContain('schema:prop99');
      expect(result).toContain('contains(?var19');
      expect(end - start).toBeLessThan(100); // Should render in <100ms
    });

    it('should render complex queries with nested structures efficiently', async () => {
      const aggregations = Array.from({ length: 10 }, (_, i) => ({
        function: ['count', 'sum', 'avg', 'min', 'max'][i % 5],
        variable: `metric${i}`,
        alias: `result${i}`
      }));

      const serviceQueries = Array.from({ length: 5 }, (_, i) => ({
        endpoint: `http://endpoint${i}.com/sparql`,
        patterns: Array.from({ length: 20 }, (_, j) => ({
          subject: `entity${j}`,
          predicate: `prop${j}`,
          object: `val${j}`
        }))
      }));

      const data = {
        baseUri: 'http://example.com',
        variables: ['entity', 'result'],
        aggregations,
        patterns: [
          { subject: 'entity', predicate: 'a', object: 'schema:Thing' }
        ],
        serviceQueries,
        groupBy: ['entity'],
        havingConditions: [
          { operator: 'greaterThan', left: 'COUNT(?item)', right: 5 }
        ],
        limit: 100
      };

      const start = performance.now();
      const result = await env.render('complex-query.sparql.njk', data);
      const end = performance.now();

      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('COUNT(?metric0) AS ?result0');
      expect(result).toContain('SERVICE <http://endpoint4.com/sparql>');
      expect(end - start).toBeLessThan(150); // Should render in <150ms
    });

    it('should handle federated queries with multiple endpoints efficiently', async () => {
      const federatedEndpoints = Array.from({ length: 8 }, (_, i) => ({
        url: `http://sparql-endpoint-${i}.org/query`,
        patterns: Array.from({ length: 25 }, (_, j) => ({
          subject: `resource${j}`,
          predicate: `http://schema.org/property${j}`,
          object: `value${j}`
        })),
        filters: Array.from({ length: 5 }, (_, k) => ({
          operator: 'regex',
          left: `value${k}`,
          right: `pattern${k}`
        }))
      }));

      const data = {
        baseUri: 'http://example.com',
        variables: ['resource', 'value'],
        localPatterns: [
          { subject: 'resource', predicate: 'a', object: 'schema:Thing' }
        ],
        federatedEndpoints,
        crossEndpointJoins: Array.from({ length: 3 }, (_, i) => ({
          leftVar: `left${i}`,
          rightVar: `right${i}`
        })),
        limit: 50
      };

      const start = performance.now();
      const result = await env.render('federated-query.sparql.njk', data);
      const end = performance.now();

      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('SERVICE <http://sparql-endpoint-7.org/query>');
      expect(result).toContain('regex(?value4, "pattern4")');
      expect(end - start).toBeLessThan(200); // Should render in <200ms
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated renderings', async () => {
      const data = {
        baseUri: 'http://example.com',
        variables: Array.from({ length: 100 }, (_, i) => `var${i}`),
        patterns: Array.from({ length: 200 }, (_, i) => ({
          subject: 'entity',
          predicate: `prop${i}`,
          object: `val${i}`
        })),
        limit: 1000
      };

      const initialMemory = process.memoryUsage().heapUsed;
      
      // Render the same query 1000 times
      for (let i = 0; i < 1000; i++) {
        await env.render('select-query.sparql.njk', data);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with query complexity', async () => {
      const complexities = [10, 50, 100, 200, 500];
      const times: number[] = [];

      for (const complexity of complexities) {
        const data = {
          baseUri: 'http://example.com',
          variables: Array.from({ length: complexity }, (_, i) => `var${i}`),
          patterns: Array.from({ length: complexity * 2 }, (_, i) => ({
            subject: 'entity',
            predicate: `prop${i}`,
            object: `val${i}`
          })),
          filters: Array.from({ length: complexity / 2 }, (_, i) => ({
            operator: 'equals',
            left: `var${i}`,
            right: `value${i}`
          })),
          limit: 100
        };

        const start = performance.now();
        const result = await env.render('select-query.sparql.njk', data);
        const end = performance.now();

        times.push(end - start);
        expect(() => parser.parse(result)).not.toThrow();
      }

      // Check that time doesn't increase exponentially
      // For linear scaling, t500 should be less than 10 * t50
      const ratio = times[4] / times[1]; // t500 / t50
      expect(ratio).toBeLessThan(20); // Allow some overhead, but not exponential
    });

    it('should handle concurrent template renderings', async () => {
      const data = {
        baseUri: 'http://example.com',
        variables: ['entity', 'name', 'value'],
        patterns: Array.from({ length: 50 }, (_, i) => ({
          subject: 'entity',
          predicate: `prop${i}`,
          object: `val${i}`
        })),
        limit: 100
      };

      const start = performance.now();
      
      // Render 20 queries concurrently
      const promises = Array.from({ length: 20 }, () =>
        env.render('select-query.sparql.njk', data)
      );
      
      const results = await Promise.all(promises);
      const end = performance.now();

      expect(results).toHaveLength(20);
      results.forEach(result => {
        expect(() => parser.parse(result)).not.toThrow();
        expect(result).toContain('SELECT ?entity ?name ?value');
      });
      
      // Concurrent rendering should be faster than sequential
      expect(end - start).toBeLessThan(500); // All 20 queries in <500ms
    });
  });

  describe('Filter Chain Performance', () => {
    it('should handle complex filter chains efficiently', () => {
      const testCases = [
        'simple string',
        'string with "quotes" and \n newlines',
        'http://example.com/resource?param=value&other=data',
        '?existingVariable',
        123,
        true,
        { operator: 'equals', left: 'var', right: 'value' },
        { type: 'sequence', properties: ['prop1', 'prop2', 'prop3'] }
      ];

      const start = performance.now();
      
      // Process each value through multiple filter chains
      testCases.forEach(testCase => {
        for (let i = 0; i < 100; i++) {
          if (typeof testCase === 'string') {
            sparqlFilters.sparqlVar(testCase);
            sparqlFilters.rdfResource(testCase);
            sparqlFilters.sparqlString(testCase);
            sparqlFilters.sparqlValue(testCase);
          } else if (typeof testCase === 'object' && testCase.operator) {
            sparqlFilters.sparqlFilter(testCase);
          } else if (typeof testCase === 'object' && testCase.type) {
            sparqlFilters.sparqlPropertyPath(testCase);
          }
        }
      });
      
      const end = performance.now();
      
      expect(end - start).toBeLessThan(50); // Should process all filter chains in <50ms
    });
  });

  describe('Real-world Query Performance', () => {
    it('should handle realistic knowledge graph queries efficiently', async () => {
      const data = {
        baseUri: 'http://knowledge.example.com',
        variables: ['entity', 'type', 'label', 'description', 'category', 'location', 'date'],
        patterns: [
          { subject: 'entity', predicate: 'a', object: 'type' },
          { subject: 'entity', predicate: 'rdfs:label', object: 'label' },
          { subject: 'entity', predicate: 'schema:description', object: 'description' },
          { subject: 'entity', predicate: 'schema:category', object: 'category' },
          { subject: 'entity', predicate: 'schema:location', object: 'location' },
          { subject: 'entity', predicate: 'schema:dateCreated', object: 'date' }
        ],
        optionalPatterns: [
          { subject: 'entity', predicate: 'schema:image', object: 'image' },
          { subject: 'entity', predicate: 'schema:url', object: 'website' }
        ],
        unionPatterns: [
          [
            { subject: 'entity', predicate: 'schema:email', object: 'contact' }
          ],
          [
            { subject: 'entity', predicate: 'schema:telephone', object: 'contact' }
          ]
        ],
        filters: [
          { operator: 'regex', left: 'label', right: '.*research.*' },
          { operator: 'greaterThan', left: 'date', right: '2020-01-01' },
          'lang(?label) = "en"',
          'bound(?description)'
        ],
        languageFilters: [
          { variable: 'label', language: 'en' },
          { variable: 'description', language: 'en' }
        ],
        regexFilters: [
          { variable: 'category', pattern: '^(science|technology)', flags: 'i' }
        ],
        orderBy: [
          { variable: 'date', direction: 'DESC' },
          { variable: 'label', direction: 'ASC' }
        ],
        limit: 100
      };

      const start = performance.now();
      const result = await env.render('complex-query.sparql.njk', data);
      const end = performance.now();

      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('SELECT ?entity ?type ?label ?description ?category ?location ?date');
      expect(result).toContain('OPTIONAL {');
      expect(result).toContain('UNION');
      expect(result).toContain('regex(?label, ".*research.*")');
      expect(result).toContain('lang(?label) = "en"');
      expect(result).toContain('ORDER BY DESC(?date) ASC(?label)');
      expect(end - start).toBeLessThan(80); // Realistic query should render in <80ms
    });
  });
});