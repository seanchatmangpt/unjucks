import { describe, it, expect, beforeEach } from 'vitest';
import nunjucks from 'nunjucks';
import { sparqlFilters } from '../../../src/lib/filters/sparql';
import { Parser as SparqlParser } from 'sparqljs';
import fs from 'fs/promises';
import path from 'path';

describe('SPARQL Template Rendering', () => {
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

  describe('SELECT Query Template', () => {
    it('should render basic SELECT query', async () => {
      const data = {
        baseUri: 'http://example.com',
        variables: ['person', 'name', 'age'],
        patterns: [
          { subject: 'person', predicate: 'a', object: 'schema:Person' },
          { subject: 'person', predicate: 'schema:name', object: 'name' },
          { subject: 'person', predicate: 'schema:age', object: 'age' }
        ],
        orderBy: ['name'],
        limit: 10
      };

      const result = await env.render('select-query.sparql.njk', data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('SELECT ?person ?name ?age');
      expect(result).toContain('?person a schema:Person');
      expect(result).toContain('ORDER BY ?name');
      expect(result).toContain('LIMIT 10');
    });

    it('should render SELECT query with filters', async () => {
      const data = {
        baseUri: 'http://example.com',
        variables: ['person', 'name', 'age'],
        patterns: [
          { subject: 'person', predicate: 'a', object: 'schema:Person' },
          { subject: 'person', predicate: 'schema:name', object: 'name' },
          { subject: 'person', predicate: 'schema:age', object: 'age' }
        ],
        filters: [
          { operator: 'greaterThan', left: 'age', right: 18 },
          { operator: 'contains', left: 'name', right: 'John' }
        ],
        distinct: true,
        orderBy: [{ variable: 'age', direction: 'DESC' }],
        limit: 20
      };

      const result = await env.render('select-query.sparql.njk', data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('SELECT DISTINCT');
      expect(result).toContain('FILTER(?age > 18)');
      expect(result).toContain('FILTER(contains(?name, "John"))');
      expect(result).toContain('ORDER BY DESC(?age)');
      expect(result).toContain('LIMIT 20');
    });

    it('should render SELECT query with OPTIONAL patterns', async () => {
      const data = {
        baseUri: 'http://example.com',
        variables: ['person', 'name', 'email'],
        patterns: [
          { subject: 'person', predicate: 'a', object: 'schema:Person' },
          { subject: 'person', predicate: 'schema:name', object: 'name' }
        ],
        optionalPatterns: [
          { subject: 'person', predicate: 'schema:email', object: 'email' }
        ],
        limit: 10
      };

      const result = await env.render('select-query.sparql.njk', data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('OPTIONAL {');
      expect(result).toContain('?person schema:email ?email');
    });

    it('should render SELECT query with UNION patterns', async () => {
      const data = {
        baseUri: 'http://example.com',
        variables: ['person', 'identifier'],
        patterns: [
          { subject: 'person', predicate: 'a', object: 'schema:Person' }
        ],
        unionPatterns: [
          [{ subject: 'person', predicate: 'schema:email', object: 'identifier' }],
          [{ subject: 'person', predicate: 'schema:telephone', object: 'identifier' }]
        ],
        limit: 10
      };

      const result = await env.render('select-query.sparql.njk', data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('UNION');
      expect(result).toContain('schema:email');
      expect(result).toContain('schema:telephone');
    });

    it('should render SELECT query with GROUP BY and HAVING', async () => {
      const data = {
        baseUri: 'http://example.com',
        variables: ['department', 'employeeCount'],
        patterns: [
          { subject: 'person', predicate: 'a', object: 'schema:Person' },
          { subject: 'person', predicate: 'schema:worksFor', object: 'department' }
        ],
        groupBy: ['department'],
        having: { operator: 'greaterThan', left: 'COUNT(?person)', right: 5 },
        orderBy: [{ variable: 'employeeCount', direction: 'DESC' }]
      };

      const result = await env.render('select-query.sparql.njk', data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('GROUP BY ?department');
      expect(result).toContain('HAVING');
      expect(result).toContain('COUNT(?person) > 5');
    });
  });

  describe('CONSTRUCT Query Template', () => {
    it('should render basic CONSTRUCT query', async () => {
      const data = {
        baseUri: 'http://example.com',
        constructTriples: [
          { subject: 'person', predicate: 'a', object: 'ex:Person' },
          { subject: 'person', predicate: 'ex:name', object: 'name' }
        ],
        wherePatterns: [
          { subject: 'person', predicate: 'a', object: 'foaf:Person' },
          { subject: 'person', predicate: 'foaf:name', object: 'name' }
        ]
      };

      const result = await env.render('construct-query.sparql.njk', data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('CONSTRUCT {');
      expect(result).toContain('?person a ex:Person');
      expect(result).toContain('WHERE {');
      expect(result).toContain('?person a foaf:Person');
    });

    it('should render CONSTRUCT query with derived triples', async () => {
      const data = {
        baseUri: 'http://example.com',
        constructTriples: [
          { subject: 'person', predicate: 'a', object: 'ex:Person' }
        ],
        derivedTriples: [
          { subject: 'person', type: 'ex:Human', label: 'Human Entity' }
        ],
        wherePatterns: [
          { subject: 'person', predicate: 'a', object: 'foaf:Person' }
        ]
      };

      const result = await env.render('construct-query.sparql.njk', data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('?person a ex:Human');
      expect(result).toContain('rdfs:label "Human Entity"');
    });

    it('should render CONSTRUCT query with subqueries', async () => {
      const data = {
        baseUri: 'http://example.com',
        constructTriples: [
          { subject: 'person', predicate: 'ex:avgAge', object: 'averageAge' }
        ],
        wherePatterns: [
          { subject: 'person', predicate: 'a', object: 'schema:Person' }
        ],
        subqueries: [
          {
            variables: ['averageAge'],
            patterns: [
              { subject: 'p', predicate: 'schema:age', object: 'age' }
            ]
          }
        ]
      };

      const result = await env.render('construct-query.sparql.njk', data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('SELECT ?averageAge');
      expect(result).toContain('?p schema:age ?age');
    });
  });

  describe('Complex Query Template', () => {
    it('should render complex query with all features', async () => {
      const data = {
        baseUri: 'http://example.com',
        variables: ['person', 'name', 'location', 'count'],
        aggregations: [
          { function: 'count', variable: 'person', alias: 'totalPersons' }
        ],
        namedGraphs: [
          {
            uri: 'http://example.com/graph1',
            patterns: [
              { subject: 'person', predicate: 'a', object: 'schema:Person' }
            ]
          }
        ],
        patterns: [
          { 
            subject: 'person', 
            propertyPath: { 
              type: 'sequence', 
              properties: ['schema:address', 'schema:addressLocality'] 
            }, 
            object: 'location' 
          }
        ],
        regexFilters: [
          { variable: 'name', pattern: '^John.*', flags: 'i' }
        ],
        languageFilters: [
          { variable: 'name', language: 'en' }
        ],
        datatypeFilters: [
          { variable: 'age', datatype: 'integer' }
        ],
        boundFilters: [
          { variable: 'email', negated: false }
        ],
        existsPatterns: [
          {
            negated: false,
            patterns: [
              { subject: 'person', predicate: 'schema:worksFor', object: 'org' }
            ]
          }
        ],
        serviceQueries: [
          {
            endpoint: 'http://dbpedia.org/sparql',
            silent: true,
            patterns: [
              { subject: 'location', predicate: 'dbo:populationTotal', object: 'population' }
            ]
          }
        ],
        groupBy: ['location'],
        havingConditions: [
          { operator: 'greaterThan', left: 'COUNT(?person)', right: 10 }
        ],
        orderBy: [
          { variable: 'count', direction: 'DESC' }
        ],
        limit: 50
      };

      const result = await env.render('complex-query.sparql.njk', data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('GRAPH <http://example.com/graph1>');
      expect(result).toContain('schema:address/schema:addressLocality');
      expect(result).toContain('regex(?name, "^John.*", "i")');
      expect(result).toContain('lang(?name) = "en"');
      expect(result).toContain('datatype(?age) = xsd:integer');
      expect(result).toContain('bound(?email)');
      expect(result).toContain('EXISTS {');
      expect(result).toContain('SERVICE SILENT <http://dbpedia.org/sparql>');
      expect(result).toContain('GROUP BY ?location');
      expect(result).toContain('HAVING COUNT(?person) > 10');
      expect(result).toContain('ORDER BY DESC(?count)');
      expect(result).toContain('LIMIT 50');
    });
  });

  describe('Federated Query Template', () => {
    it('should render federated query with multiple endpoints', async () => {
      const data = {
        baseUri: 'http://example.com',
        variables: ['person', 'name', 'dbpediaInfo'],
        localPatterns: [
          { subject: 'person', predicate: 'a', object: 'schema:Person' },
          { subject: 'person', predicate: 'schema:name', object: 'name' }
        ],
        federatedEndpoints: [
          {
            url: 'http://dbpedia.org/sparql',
            patterns: [
              { subject: 'dbpediaResource', predicate: 'rdfs:label', object: 'dbpediaInfo' }
            ],
            filters: [
              { operator: 'equals', left: 'dbpediaResource', right: 'name' }
            ]
          }
        ],
        crossEndpointJoins: [
          { leftVar: 'name', rightVar: 'dbpediaInfo' }
        ],
        conditionalServices: [
          {
            endpoint: 'http://wikidata.org/sparql',
            patterns: [
              { subject: 'wikidataItem', predicate: 'wdt:P31', object: 'wikidataClass' }
            ]
          }
        ],
        orderBy: ['name'],
        limit: 20
      };

      const result = await env.render('federated-query.sparql.njk', data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('SERVICE <http://dbpedia.org/sparql>');
      expect(result).toContain('FILTER(?dbpediaResource = "name")');
      expect(result).toContain('FILTER(?name = ?dbpediaInfo)');
      expect(result).toContain('OPTIONAL {');
      expect(result).toContain('SERVICE <http://wikidata.org/sparql>');
    });
  });

  describe('UPDATE Query Template', () => {
    it('should render INSERT DATA query', async () => {
      const data = {
        baseUri: 'http://example.com',
        operation: 'INSERT',
        insertTriples: [
          { subject: 'http://example.com/person/1', predicate: 'a', object: 'schema:Person' },
          { subject: 'http://example.com/person/1', predicate: 'schema:name', object: 'John Doe' }
        ]
      };

      const result = await env.render('update-query.sparql.njk', data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('INSERT DATA {');
      expect(result).toContain('<http://example.com/person/1> a schema:Person');
      expect(result).toContain('schema:name "John Doe"');
    });

    it('should render DELETE/INSERT query', async () => {
      const data = {
        baseUri: 'http://example.com',
        operation: 'DELETE_INSERT',
        deleteTriples: [
          { subject: 'person', predicate: 'schema:name', object: 'oldName' }
        ],
        insertTriples: [
          { subject: 'person', predicate: 'schema:name', object: 'newName' }
        ],
        wherePatterns: [
          { subject: 'person', predicate: 'a', object: 'schema:Person' },
          { subject: 'person', predicate: 'schema:name', object: 'oldName' }
        ],
        filters: [
          { operator: 'equals', left: 'person', right: 'http://example.com/person/1' }
        ]
      };

      const result = await env.render('update-query.sparql.njk', data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('DELETE {');
      expect(result).toContain('INSERT {');
      expect(result).toContain('WHERE {');
      expect(result).toContain('FILTER(?person = <http://example.com/person/1>)');
    });

    it('should render graph management queries', async () => {
      const operations = [
        { operation: 'CREATE', graphUri: 'http://example.com/graph1' },
        { operation: 'DROP', graphUri: 'http://example.com/graph1', silent: true },
        { operation: 'CLEAR', graphUri: 'http://example.com/graph1' },
        { operation: 'COPY', sourceGraph: 'DEFAULT', targetGraph: 'http://example.com/graph1' },
        { operation: 'MOVE', sourceGraph: 'http://example.com/source', targetGraph: 'http://example.com/target' },
        { operation: 'ADD', sourceGraph: 'http://example.com/source', targetGraph: 'http://example.com/target' }
      ];

      for (const data of operations) {
        const result = await env.render('update-query.sparql.njk', data);
        
        expect(() => parser.parse(result)).not.toThrow();
        expect(result).toContain(data.operation);
        if (data.graphUri) {
          expect(result).toContain(`<${data.graphUri}>`);
        }
        if (data.silent) {
          expect(result).toContain('SILENT');
        }
      }
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should generate queries compatible with Apache Jena', async () => {
      const data = {
        baseUri: 'http://example.com',
        variables: ['person', 'name'],
        patterns: [
          { subject: 'person', predicate: 'a', object: 'schema:Person' },
          { subject: 'person', predicate: 'schema:name', object: 'name' }
        ],
        filters: [
          { operator: 'regex', left: 'name', right: '.*John.*' }
        ]
      };

      const result = await env.render('select-query.sparql.njk', data);
      
      // Jena-specific validation
      expect(result).not.toContain('UNDEF');  // Jena doesn't support UNDEF
      expect(result).toContain('regex(?name, ".*John.*")');
      expect(() => parser.parse(result)).not.toThrow();
    });

    it('should generate queries compatible with Virtuoso', async () => {
      const data = {
        baseUri: 'http://example.com',
        variables: ['person', 'name'],
        patterns: [
          { subject: 'person', predicate: 'a', object: 'schema:Person' },
          { subject: 'person', predicate: 'schema:name', object: 'name' }
        ],
        limit: 1000  // Virtuoso has different default limits
      };

      const result = await env.render('select-query.sparql.njk', data);
      
      expect(result).toContain('LIMIT 1000');
      expect(() => parser.parse(result)).not.toThrow();
    });
  });

  describe('Performance Optimization', () => {
    it('should handle large query templates efficiently', async () => {
      const startTime = Date.now();
      
      // Generate a large query with many patterns
      const patterns = Array.from({ length: 100 }, (_, i) => ({
        subject: 'person',
        predicate: `schema:property${i}`,
        object: `value${i}`
      }));

      const data = {
        baseUri: 'http://example.com',
        variables: ['person'],
        patterns,
        limit: 10
      };

      const result = await env.render('select-query.sparql.njk', data);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('schema:property99');
      expect(duration).toBeLessThan(500); // Should render in less than 500ms
    });
  });
});