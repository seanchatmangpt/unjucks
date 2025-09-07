import { describe, it, expect, beforeEach } from 'vitest';
import nunjucks from 'nunjucks';
import { sparqlFilters } from '../../../src/lib/filters/sparql';
import { Parser as SparqlParser } from 'sparqljs';

describe('SPARQL Filter Validation', () => {
  let env: nunjucks.Environment;
  let parser: SparqlParser;

  beforeEach(() => {
    env = new nunjucks.Environment();
    
    // Register all SPARQL filters
    Object.entries(sparqlFilters).forEach(([name, filter]) => {
      env.addFilter(name, filter);
    });
    
    // Add built-in Nunjucks filters that we use
    env.addFilter('map', (arr, prop) => arr.map(item => typeof prop === 'string' ? item[prop] : prop(item)));
    env.addFilter('join', (arr, sep) => arr.join(sep || ''));

    parser = new SparqlParser({
      // Set a base IRI to resolve relative IRIs
      baseIRI: 'http://example.com/'
    });
  });

  describe('Basic Filter Functions', () => {
    it('should convert strings to SPARQL variables', () => {
      expect(sparqlFilters.sparqlVar('name')).toBe('?name');
      expect(sparqlFilters.sparqlVar('?existing')).toBe('?existing');
      expect(sparqlFilters.sparqlVar('user-name')).toBe('?user_name');
      expect(sparqlFilters.sparqlVar('123invalid')).toBe('?_123invalid');
    });

    it('should format RDF resources correctly', () => {
      expect(sparqlFilters.rdfResource('http://example.com/resource')).toBe('<http://example.com/resource>');
      expect(sparqlFilters.rdfResource('ex:Person')).toBe('ex:Person');
      expect(sparqlFilters.rdfResource('/local/resource')).toBe('</local/resource>');
    });

    it('should handle RDF properties', () => {
      expect(sparqlFilters.rdfProperty('a')).toBe('a');
      expect(sparqlFilters.rdfProperty('rdf:type')).toBe('a');
      expect(sparqlFilters.rdfProperty('schema:name')).toBe('schema:name');
      expect(sparqlFilters.rdfProperty('http://schema.org/name')).toBe('<http://schema.org/name>');
    });

    it('should format SPARQL values appropriately', () => {
      expect(sparqlFilters.sparqlValue('name')).toBe('?name');
      expect(sparqlFilters.sparqlValue('http://example.com')).toBe('<http://example.com>');
      expect(sparqlFilters.sparqlValue(42)).toBe('42');
      expect(sparqlFilters.sparqlValue(true)).toBe('true');
      expect(sparqlFilters.sparqlValue('literal string')).toBe('"literal string"');
    });

    it('should escape SPARQL strings properly', () => {
      expect(sparqlFilters.sparqlString('simple')).toBe('"simple"');
      expect(sparqlFilters.sparqlString('with "quotes"')).toBe('"with \\"quotes\\""');
      expect(sparqlFilters.sparqlString('with\nnewlines')).toBe('"with\\nnewlines"');
      expect(sparqlFilters.sparqlString('with\ttabs')).toBe('"with\\ttabs"');
    });

    it('should create RDF typed literals', () => {
      expect(sparqlFilters.rdfValue(42)).toBe('"42"^^xsd:integer');
      expect(sparqlFilters.rdfValue(3.14)).toBe('"3.14"^^xsd:decimal');
      expect(sparqlFilters.rdfValue(true)).toBe('"true"^^xsd:boolean');
      expect(sparqlFilters.rdfValue('text', 'xsd:string')).toBe('"text"^^xsd:string');
    });

    it('should handle Schema.org classes', () => {
      expect(sparqlFilters.schemaOrg('person')).toBe('schema:Person');
      expect(sparqlFilters.schemaOrg('local-business')).toBe('schema:LocalBusiness');
      expect(sparqlFilters.schemaOrg('creative_work')).toBe('schema:CreativeWork');
    });
  });

  describe('SPARQL Filter Expressions', () => {
    it('should handle string filter expressions', () => {
      const filter = 'str(?name) = "John"';
      expect(sparqlFilters.sparqlFilter(filter)).toBe(filter);
    });

    it('should handle object filter expressions', () => {
      const filters = [
        { operator: 'equals', left: 'name', right: 'John' },
        { operator: 'greaterThan', left: 'age', right: 18 },
        { operator: 'contains', left: 'description', right: 'test' },
        { operator: 'regex', left: 'email', right: '.*@example\\.com' },
        { operator: 'bound', left: 'optionalField' },
        { operator: 'lang', left: 'title', right: 'en' }
      ];

      const expected = [
        '?name = "John"',
        '?age > 18',
        'contains(?description, "test")',
        'regex(?email, ".*@example\\.com")',
        'bound(?optionalField)',
        'lang(?title) = "en"'
      ];

      filters.forEach((filter, index) => {
        expect(sparqlFilters.sparqlFilter(filter)).toBe(expected[index]);
      });
    });
  });

  describe('Property Path Expressions', () => {
    it('should handle simple property paths', () => {
      expect(sparqlFilters.sparqlPropertyPath('schema:name')).toBe('schema:name');
    });

    it('should handle complex property paths', () => {
      const paths = [
        { type: 'sequence', properties: ['schema:member', 'schema:name'] },
        { type: 'alternative', properties: ['schema:name', 'rdfs:label'] },
        { type: 'zeroOrMore', properties: ['schema:subOrganization'] },
        { type: 'oneOrMore', properties: ['schema:parent'] },
        { type: 'zeroOrOne', properties: ['schema:description'] },
        { type: 'inverse', properties: ['schema:memberOf'] },
        { type: 'negated', properties: ['schema:name', 'rdfs:label'] }
      ];

      const expected = [
        'schema:member/schema:name',
        'schema:name|rdfs:label',
        'schema:subOrganization*',
        'schema:parent+',
        'schema:description?',
        '^schema:memberOf',
        '!(schema:name|rdfs:label)'
      ];

      paths.forEach((path, index) => {
        expect(sparqlFilters.sparqlPropertyPath(path)).toBe(expected[index]);
      });
    });
  });

  describe('Aggregation Functions', () => {
    it('should handle aggregation expressions', () => {
      const aggregations = [
        { function: 'count', variable: 'item' },
        { function: 'count', variable: 'item', distinct: true },
        { function: 'sum', variable: 'price' },
        { function: 'avg', variable: 'rating' },
        { function: 'min', variable: 'date' },
        { function: 'max', variable: 'date' },
        { function: 'sample', variable: 'example' },
        { function: 'groupConcat', variable: 'tags' },
        { function: 'count', variable: 'item', alias: 'total' }
      ];

      const expected = [
        'COUNT(?item)',
        'COUNT(DISTINCT ?item)',
        'SUM(?price)',
        'AVG(?rating)',
        'MIN(?date)',
        'MAX(?date)',
        'SAMPLE(?example)',
        'GROUP_CONCAT(?tags)',
        'COUNT(?item) AS ?total'
      ];

      aggregations.forEach((agg, index) => {
        expect(sparqlFilters.sparqlAggregation(agg)).toBe(expected[index]);
      });
    });
  });

  describe('Order By Expressions', () => {
    it('should handle order by expressions', () => {
      expect(sparqlFilters.sparqlOrderBy('name')).toBe('?name');
      expect(sparqlFilters.sparqlOrderBy({ variable: 'name' })).toBe('?name');
      expect(sparqlFilters.sparqlOrderBy({ variable: 'name', direction: 'DESC' })).toBe('DESC(?name)');
      expect(sparqlFilters.sparqlOrderBy({ expression: 'str(?name)', direction: 'ASC' })).toBe('ASC(str(?name))');
    });
  });

  describe('Template Integration Tests', () => {
    it('should generate valid SELECT queries', async () => {
      const template = `
PREFIX ex: <{{ baseUri | rdfResource }}/>
PREFIX schema: <http://schema.org/>

SELECT {{ variables | map('sparqlVar') | join(' ') }}
WHERE {
  {{ subject | sparqlVar }} a {{ type | schemaOrg }} ;
                {{ property | rdfProperty }} {{ object | sparqlVar }} .
  
  FILTER({{ condition | sparqlFilter }})
}
ORDER BY {{ sortVar | sparqlVar }}
LIMIT {{ limit }}`;

      const data = {
        baseUri: 'http://example.com',
        variables: ['name', 'age', 'email'],
        subject: 'person',
        type: 'person',
        property: 'schema:name',
        object: 'name',
        condition: { operator: 'greaterThan', left: 'age', right: 18 },
        sortVar: 'name',
        limit: 10
      };

      const result = env.renderString(template, data);
      
      // Validate the generated SPARQL is syntactically correct
      expect(() => parser.parse(result)).not.toThrow();
      
      expect(result).toContain('SELECT ?name ?age ?email');
      expect(result).toContain('?person a schema:Person');
      expect(result).toContain('FILTER(?age > 18)');
      expect(result).toContain('ORDER BY ?name');
      expect(result).toContain('LIMIT 10');
    });

    it('should generate valid CONSTRUCT queries', () => {
      const template = `
PREFIX ex: <{{ baseUri | rdfResource }}/>
PREFIX schema: <http://schema.org/>

CONSTRUCT {
  {{ subject | sparqlVar }} a {{ type | schemaOrg }} ;
                {{ property | rdfProperty }} {{ object | sparqlValue }} .
}
WHERE {
  {{ subject | sparqlVar }} {{ sourceProperty | rdfProperty }} {{ sourceObject | sparqlVar }} .
  
  FILTER({{ condition | sparqlFilter }})
}`;

      const data = {
        baseUri: 'http://example.com',
        subject: 'person',
        type: 'person',
        property: 'schema:name',
        object: 'name',
        sourceProperty: 'foaf:name',
        sourceObject: 'name',
        condition: 'bound(?name)'
      };

      const result = env.renderString(template, data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('CONSTRUCT');
      expect(result).toContain('?person a schema:Person');
      expect(result).toContain('FILTER(bound(?name))');
    });

    it('should handle complex queries with multiple filter types', () => {
      const template = `
PREFIX ex: <{{ baseUri | rdfResource }}/>
PREFIX schema: <http://schema.org/>

SELECT ?person ?name ?age
WHERE {
  ?person a schema:Person ;
          schema:name ?name ;
          schema:age ?age .
  
  {% for filter in filters %}
  FILTER({{ filter | sparqlFilter }})
  {% endfor %}
}`;

      const data = {
        baseUri: 'http://example.com',
        filters: [
          { operator: 'greaterThan', left: 'age', right: 18 },
          { operator: 'contains', left: 'name', right: 'John' },
          { operator: 'regex', left: 'name', right: '^[A-Z].*' },
          'lang(?name) = "en"'
        ]
      };

      const result = env.renderString(template, data);
      
      expect(() => parser.parse(result)).not.toThrow();
      expect(result).toContain('FILTER(?age > 18)');
      expect(result).toContain('FILTER(contains(?name, "John"))');
      expect(result).toContain('FILTER(regex(?name, "^[A-Z].*"))');
      expect(result).toContain('FILTER(lang(?name) = "en")');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty/null values gracefully', () => {
      expect(sparqlFilters.sparqlVar('')).toBe('');
      expect(sparqlFilters.sparqlVar(null as any)).toBe('');
      expect(sparqlFilters.rdfResource('')).toBe('');
      expect(sparqlFilters.sparqlString('')).toBe('""');
      expect(sparqlFilters.sparqlFilter('')).toBe('');
    });

    it('should handle invalid filter objects', () => {
      expect(sparqlFilters.sparqlFilter({ invalid: 'object' })).toBe('[object Object]');
      expect(sparqlFilters.sparqlFilter(null)).toBe('');
      expect(sparqlFilters.sparqlFilter(undefined)).toBe('');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', () => {
      const startTime = Date.now();
      
      // Generate a large query with many filters
      const filters = Array.from({ length: 1000 }, (_, i) => ({
        operator: 'equals',
        left: `var${i}`,
        right: `value${i}`
      }));

      filters.forEach(filter => {
        sparqlFilters.sparqlFilter(filter);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should process 1000 filters in less than 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});